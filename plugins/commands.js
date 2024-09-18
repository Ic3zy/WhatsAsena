const baileys = require('@whiskeysockets/baileys');
const path = require('path');
const configPath = path.join(__dirname, '..', 'config.js');
const axios = require('axios');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const fsp = require('fs').promises;
const fs = require('fs');
const { writeFile } = require('fs/promises');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { profile } = require('console');
const { weather } = require('ic3zyapi');
let config = require(configPath);
let sudo = config.SUDOUSER;
let onestart = true;
let convertSudo = [];
let wk = config.WORKTYPE === 'public' ? true : false;
let prefix = config.HANDLERS;
let alv = config.ALIVEMSG;
let commands = komutlar = [
	{ name: 'add', description: 'Gruba Kişi eklemenizi sağlar örn: .add 905510310485 || veya grupta olmayan birine yanıt.' },
	{ name: 'alive', description: 'Botun çalışıp çalışmadığını kontrol eder.' },
	{ name: 'asena', description: 'Tüm komutları gösterir.' },
	{ name: 'ban', description: 'Gruptan kişi banlamanızı sağlar' },
	{ name: 'demote', description: 'Yanıt verilen kişiyi adminlikten çıkartır.'},
	{ name: 'promote', description: 'Yanıt verilen kişiyi admin yapar.'},
	{ name: 'sticker', description: 'Yanıt verilen medyayı sticker yapar.' },
	{ name: 'setvar_SUDOUSER', description: `Sudo'ları değiştirmek için kullanılır. Örnek: .setvar_SUDO '905510310485','90512345678'` },
	{ name: 'setvar_ALIVEMSG', description: 'Alive mesajını değiştirmek için kullanabilirsiniz. Alive argümanları için: .helpalive' },
	{ name: 'setvar_WORKTYPE', description: 'Worktype değiştirmenizi sağlar örn: setvar_WORKTYPE private // veya public olarak değiştirebilirsiniz. || public ise herkes kullanabilir: private sadece siz.' },
	{ name: 'setvar_HANDLERS', description: `Prefixinizi güncellemenizi sağlar. örn: .setvar_HANDLERS '.','!,'*'` }
]
for (const a of sudo) {
	var convert = `${a}@s.whatsapp.net`;
	convertSudo.push(convert);
}
async function reloadConfig() {
    try {
        delete require.cache[require.resolve(configPath)];
        config = require(configPath);
		alv = '';
		alv = config.ALIVEMSG;
		prefix = [];
		prefix = config.HANDLERS;
		wk = config.WORKTYPE === 'public' ? true : false;
		sudo = config.SUDOUSER;
		convertSudo = [];
		for (const a of sudo) {
			var convert = `${a}@s.whatsapp.net`;
			convertSudo.push(convert);
		}
        console.log("Config dosyası başarıyla yeniden yüklendi.");
        console.log(config); 
    } catch (error) {
        console.error("Config dosyası yeniden yüklenirken hata oluştu:", error);
    }
}
async function downloadMedia(message) {
    const media = message.imageMessage || message.videoMessage || message.audioMessage;

    if (!media) {
        throw new Error('Medya içeriği bulunamadı.');
    }

    const buffer = await baileys.downloadContentFromMessage(message, media.mimetype);
    const filePath = path.join(__dirname, `downloaded_media.${media.mimetype.split('/')[1]}`);
    
    return new Promise((resolve, reject) => {
        fs.writeFile(filePath, buffer, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve(filePath);
            }
        });
    });
}
async function downloadProfilePicture(sock, jid, outputFilePath) {
    try {
        const profilePictureUrl = await sock.profilePictureUrl(jid, 'image');
        const response = await axios.get(profilePictureUrl, { responseType: 'arraybuffer' });
        if (response.status !== 200) throw new Error('Failed to fetch profile picture');
        const buffer = Buffer.from(response.data);
        fs.writeFileSync(outputFilePath, buffer);
        console.log(`Profil fotoğrafı ${outputFilePath} olarak kaydedildi.`);
    } catch (error) {
        console.error(`Profil fotoğrafı alınırken bir hata oluştu: ${error.message}`);
    }
}
async function checkIfBotIsAdmin(sock, groupJid) {
	try {
	  const groupMetadata = await sock.groupMetadata(groupJid);
	  const admins = groupMetadata.participants.filter(participant => participant.admin === 'admin' || participant.admin === 'superadmin');
	  const bottid = sock.user.id;
	  const botjid = bottid.split(':')
	  const botJid = `${botjid[0]}@s.whatsapp.net`;
	  const isBotAdmin = admins.some(admin => admin.id === botJid);
	  
	  if (isBotAdmin) {
		console.log("Bot bu grupta bir admin.");
	  } else {
		console.log("Bot bu grupta admin değil.");
	  }
  
	  return isBotAdmin;
	} catch (error) {
	  console.error("Botun admin olup olmadığını kontrol ederken hata oluştu:", error);
	}
  }
async function replaceUserPosition(sock, groupJid, userJid, argm) {
	try {
	   /*
	  	* If argm = add, it adds a person to the group.
		* If argm = remove, it removes a person from the group.
		* If argm = promote, it makes a person an admin in the group.
		* If argm = demote, it removes a person from their admin role in the group.
		*/
		const result = await sock.groupParticipantsUpdate(
			groupJid,
			[userJid],
			`${argm}`
		);
		if (result) {
			console.log(`${userJid} gruba eklendi.`);
		} else {
			console.log(`${userJid} gruba eklenemedi.`);
		}
	} catch (error) {
		console.error('Gruba üye işlemi yapılırken hata oluştu:', error);
	}
}
// async function removeMemberFromGroup(sock, groupJid, userJids) {
// 	try {
// 	  if (userJids.length > 2) {
// 		console.log('Birden fazla kullanıcı çıkarmaya çalıştınız. İşlem yapılmadı.');
// 	  }
// 	  const result = await sock.groupParticipantsUpdate(
// 		groupJid,
// 		[userJids],
// 		'remove'
// 	  );
	  
// 	  if (result) {
// 		console.log(`${userJids[0]} gruptan çıkarıldı.`);
// 	  } else {
// 		console.log(`${userJids[0]} gruptan çıkarılamadı.`);
// 	  }
// 	} catch (error) {
// 	  console.error('Gruptan üye çıkarılırken hata oluştu:', error);
// 	}
//   }
// async function promoteMemberFromGroup(sock, groupJid, userJids) {
// 	try {
// 	  // Eğer çıkarılacak kullanıcı sayısı birden fazla ise hiçbir işlem yapılmasın
// 	  if (userJids.length > 2) {
// 		console.log('Birden fazla kullanıcı çıkarmaya çalıştınız. İşlem yapılmadı.');
// 	  }
// 	  const result = await sock.groupParticipantsUpdate(
// 		groupJid,         // Grubun JID'si
// 		[userJids],         // Çıkarmak istediğiniz kişinin JID'si (dizi formatında)
// 		'promote'          // Eylem: 'remove' (çıkarma işlemi)
// 	  );
	  
// 	  if (result) {
// 		console.log(`${userJids[0]} gruptan çıkarıldı.`);
// 	  } else {
// 		console.log(`${userJids[0]} gruptan çıkarılamadı.`);
// 	  }
// 	} catch (error) {
// 	  console.error('Gruptan üye çıkarılırken hata oluştu:', error);
// 	}
//   }
async function checkUserInGroup(sock, groupJid, userJid) {
    try {
        let groupMetadata = await sock.groupMetadata(groupJid);
        let participants = groupMetadata.participants.map(function(participant) {
            return participant.id;
        });
        let isInGroup = participants.includes(userJid);

        if (isInGroup) {
            console.log(userJid + ' is in the group ' + groupJid);
        } else {
            console.log(userJid + ' is not in the group ' + groupJid);
        }

        return isInGroup;
    } catch (error) {
        console.error('An error occurred:', error);
        return false;
    }
}
async function checkIsAdmin(sock, groupJid, userJid) {
	try {
	  const groupMetadata = await sock.groupMetadata(groupJid);
	  
	  const admins = groupMetadata.participants.filter(participant => participant.admin === 'admin' || participant.admin === 'superadmin');
	  const isUserAdmin = admins.some(admin => admin.id === userJid);
	  
	  if (isUserAdmin) {
		console.log("Verilen Jid bu grupta bir admin.");
	  } else {
		console.log("Verilen Jid bu grupta admin değil.");
	  }
  
	  return isUserAdmin;
	} catch (error) {
	  console.error("Verilen Jidin admin olup olmadığını kontrol ederken hata oluştu:", error);
	}
  }
async function saveConfig(updatedConfig) {
    try {
        await fsp.writeFile(configPath, updatedConfig, 'utf-8');
        console.log('config.js dosyası başarıyla güncellendi.');
    } catch (error) {
        console.error('Dosya kaydetme hatası:', error);
    }
}
async function updateValueInConfig(newValue, variableName) {
    try {
        let configFile = await fsp.readFile(configPath, 'utf-8');
        const variableRegex = new RegExp(`${variableName}:\\s*['"]?(.*?)['"]?\\s*(,|})`, 's');
        if (configFile.match(variableRegex)) {
            const updatedVariable = `${variableName}: '${newValue}'$2`;
            configFile = configFile.replace(variableRegex, updatedVariable);
            await saveConfig(configFile);
            console.log(`${variableName} değişkeni güncellendi ve yeni değer: ${newValue}`);
        } else {
            console.error(`${variableName} değişkeni bulunamadı veya liste değil.`);
        }
    } catch (error) {
        console.error('Dosya okuma veya yazma hatası:', error);
    }
}
async function updateArrayInConfig(newUserId, arrayName) {
    try {
        let configFile = await fsp.readFile(configPath, 'utf-8');
        const arrayRegex = new RegExp(`${arrayName}:\\s*\\[(.*?)\\]`, 's');
        if (configFile.match(arrayRegex)) {
            const updatedArray = `${arrayName}: [${newUserId}]`;
            configFile = configFile.replace(arrayRegex, updatedArray);
            await saveConfig(configFile);
            console.log(`${arrayName} dizisi temizlendi ve sadece ${newUserId} eklendi.`);
        } else {
            console.error(`${arrayName} dizisi bulunamadı veya bir liste değil.`);
        }
    } catch (error) {
        console.error('Dosya okuma veya yazma hatası:', error);
    }
}

module.exports = {
	handleCommand: async (sock, message) => {
		const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
		console.log('yeni mesaj => ', text);
		if (!text) {
			console.log('Mesajda text bulunamadı.');
			return;
		}
		for (const prf of prefix) {
			/* PUBLİC COMMANDS */
			if (text === `${prf}alive` || 
				text === `${prf}asena` ||
				text.startsWith(`${prf}getprofile`) ||
				text.startsWith(`${prf}sticker`) ||
				text.startsWith(`${prf}weather`)
				) {

				/* SUDO CONTROLS */

				const chatId = message.key.remoteJid;
				var fromMe = message.key.fromMe;
				if (chatId.includes('@g.us')) {
					var userId = message.key.participant;
				}
				else {
					var userId = message.key.remoteJid;
				}
				var botId = sock.user.id;
				let onay = false;
				if (!fromMe) {
					for (const a of convertSudo) {
						if (a === userId) onay = true;
					}
				}

				/* if fromMe YOUR MESSAGE : true and false, onay SUDO CONTROL, if wk WORKTYPE = PUBLİC: true AND false*/
				/* PUBLİC COMMANDS */
				if (!fromMe && !onay && !wk) return;
				console.log(convertSudo);
				console.log(sock);
				if (text === `${prf}alive`) {
					if (alv === 'default' || alv === '' || alv === ' ') {
						alv = 'Tanrı Türk\'ü Korusun. 🐺 Asena Hizmetinde!\n\n*Version*: '+config.VERSION+'\n*Branch*: '+config.BRANCH+'\n*Telegram Group*: https://t.me/AsenaSupport\n*Telegram Channel:* https://t.me/asenaremaster';
						sock.sendMessage(message.key.remoteJid, { text: alv});
					} 
					else {
						var arg = ['{pp}', '{version}', '{branch}', '{default}', '{image}'];
						alv = config.ALIVEMSG;
						if (alv.includes(arg[1])) {alv = alv.replace(`${arg[1]}`, `${config.VERSION}`);}
						if (alv.includes(arg[2])) {alv = alv.replace(`${arg[2]}`, `${config.BRANCH}`);}
						if (alv.includes(arg[3])) {alv = alv.replace(`${arg[3]}`, 'Tanrı Türk\'ü Korusun. 🐺 Asena Hizmetinde!\n\n*Version*: '+config.VERSION+'\n*Branch*: '+config.BRANCH+'\n*Telegram Group*: https://t.me/AsenaSupport\n*Telegram Channel:* https://t.me/asenaremaster');}
						if (alv.includes(arg[0])) {
							var profilepath = `${path.join(__dirname, '..')}\\assets\\aliveprofile.png`;
							console.log('pp indiriliyor...');
							alv = alv.replace(`${arg[0]}`, '');
							var idps = sock.user.id;
							var idsl = idps.split(':')
							var ids = `${idsl[0]}@s.whatsapp.net`;
							if (!fs.existsSync(profilepath)) {
								onestart = false;
								try {
									//console.log(profilepath)
									await downloadProfilePicture(sock, ids, profilepath);
									var prfc = fs.readFileSync(profilepath);
									sock.sendMessage(message.key.remoteJid, { image: prfc, caption: alv});
								} catch (error) {
									console.error('Profil fotoğrafı indirilirken bir hata oluştu:', error);
								}
								return;
							} else {
								var prfc = fs.readFileSync(profilepath);
								sock.sendMessage(message.key.remoteJid, { image: prfc, caption: alv})
							}
						} else if (alv.includes(arg[4])) {
							var asspath = path.join(__dirname, '..', 'assets');
							var imagepath = `${asspath}\\aliveimage.png`;
							if (fs.existsSync(imagepath)) {
								var image = fs.readFileSync(imagepath);
								alv = alv.replace(`${arg[4]}`, '');
								sock.sendMessage(message.key.remoteJid, { image: image, caption: alv});
							}
							else sock.sendMessage(message.key.remoteJid, { text: 'Alive Error!\n{image} Argümanını kullanabilmek için önceden bir mesaja yanıt vererek .imagealive yazmanız gerekmektedir'})
						} else {
							var dflv = 'Tanrı Türk\'ü Korusun. 🐺 Asena Hizmetinde!\n\n*Version*: '+config.VERSION+'\n*Branch*: '+config.BRANCH+'\n*Telegram Group*: https://t.me/AsenaSupport\n*Telegram Channel:* https://t.me/asenaremaster';
							if (alv.includes(arg[3])) sock.sendMessage(message.key.remoteJid, { text: dflv});
							else sock.sendMessage(message.key.remoteJid, { text: alv});
						}
					}
				} else if (text === `${prf}imagealive`) {
					if (!message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
						await sock.sendMessage(message.key.remoteJid, { text: 'Lütfen bir medya mesajına yanıt verin.' });
						return;
					}
					sock.sendMessage(message.key.remoteJid, { text: 'Media indiriliyor lütfen bekleyiniz...'});
					var asspath = path.join(__dirname, '..', 'assets');
					var imagepath = `${asspath}\\aliveimage.png`;
					const quotedMessage = message.message.extendedTextMessage.contextInfo.quotedMessage;
					const quotedMessageType = Object.keys(quotedMessage)[0];
					if (quotedMessageType === 'imageMessage') {
						const buffer = await downloadMediaMessage(
							{ message: quotedMessage },
							'buffer',
							{},
							{
								logger: console,
								reuploadRequest: sock.updateMediaMessage
							}
						);
						fs.writeFileSync(imagepath, buffer);
						sock.sendMessage(message.key.remoteJid, { text: 'Media indirildi artık: {image} argümanı ile alive mesajınızda kullanabilirsiniz.'});
					}
				} else if (text === `${prf}asena`) {
					let sonuc = "●▬▬▬ WhatsIc3zy Public ▬▬▬●\n\n";
					commands.forEach(command => {
						sonuc += `🛠: ${command.name}\n💬: ${command.description}\n\n`;
					});
					sock.sendMessage(message.key.remoteJid, { text: sonuc});
				} else  if (text.startsWith(`${prf}sticker`)) {
					if (!message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
						await sock.sendMessage(message.key.remoteJid, { text: 'Lütfen bir medya mesajına yanıt verin.' });
						return;
					}
		
					const quotedMessage = message.message.extendedTextMessage.contextInfo.quotedMessage;
					const quotedMessageType = Object.keys(quotedMessage)[0];
					if (quotedMessageType === 'imageMessage' || quotedMessageType === 'videoMessage') {
						const buffer = await downloadMediaMessage(
							{ message: quotedMessage },
							'buffer',
							{},
							{
								logger: console,
								reuploadRequest: sock.updateMediaMessage
							}
						);
						const tempFile = quotedMessageType === 'imageMessage' ? 'temp_image.jpg' : 'temp_video.mp4';
						const stickerFile = 'sticker.webp';
						fs.writeFileSync(tempFile, buffer);
						ffmpeg(tempFile)
							.outputOptions(["-y", "-vcodec libwebp"])
							.videoFilters('scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1')
							.save(stickerFile)
							.on('end', async () => {
								var stickerf = fs.readFileSync(stickerFile)
								await sock.sendMessage(message.key.remoteJid, {
									sticker: fs.readFileSync(stickerFile)
								});
								fs.unlinkSync(tempFile);
								fs.unlinkSync(stickerFile);
							});
					} else {
						await sock.sendMessage(message.key.remoteJid, { text: 'Lütfen bir görsel veya videoya yanıt verin.' });
					}
				} else if (text.startsWith(`${prf}getprofile`)) {
					let quotedMessage = false;
					try {
						quotedMessage = message.message.extendedTextMessage.contextInfo;
					} catch {
						quotedMessage = false;
					}
					const chatType = message.key.remoteJid.includes('@g.us') ? 'group' : 'individual';
					//console.log(message.key.remoteJid);
					let ids = '';
					//console.log(quotedMessage);
					if (quotedMessage) {
						ids = quotedMessage.participant;
						//console.log(ids)
					}
					else {
						ids = message.key.remoteJid;
					}
					try {
						var profilepath = `${path.join(__dirname, '..')}\\assets\\profile.png`;
						//console.log(profilepath)
						await downloadProfilePicture(sock, ids, profilepath);
						var prfc = fs.readFileSync(profilepath);
						sock.sendMessage(message.key.remoteJid, { image: prfc, caption: 'MadeBy WhatsAsena'});
					} catch (error) {
						console.error('Profil fotoğrafı indirilirken bir hata oluştu:', error);
					}
				} else if (text.startsWith(`${prf}weather`)) {
					if (!text.includes(' ')) { sock.sendMessage(message.key.remoteJid, { text: 'Lütfen bir şehir giriniz.'});return;}
					var country = text.replace(`${prf}weather `, '');
					var { sicaklik, nem, ruzgar, bulut } = await weather(country);
					sock.sendMessage(message.key.remoteJid, { text: `_*${country}*' için hava durumu_:\n\n*Sıcaklık*: _${sicaklik}_\n*Nem*: _${nem}_\n*Rüzgar hızı*: _${ruzgar}_\n*Bulut durumu*: _${bulut}_`});
					return;
				} 
			/* SUDO OR USER COMMANDS AND ALWAYS GROUP COMMANDS */
			} else if (
				text.startsWith(`${prf}admin`) ||
				text.startsWith(`${prf}add`) ||
				text.startsWith(`${prf}ban`) ||
				text.startsWith(`${prf}promote`) ||
				text.startsWith(`${prf}demote`)
			) {
				/* ------ group controls ------ */
				if (message.key.remoteJid.includes('@g.us')) {
					var usId = message.key.participant;
					var fromMe = message.key.fromMe;
					let onay = false;
					if (!fromMe) {
						for (const i of convertSudo) {
							if (i === usId) {
								onay = true;
							}
						}
					}
					/* ---- always sudo and fromMe command ---- */
					if (!fromMe && !onay) return;
					var isBotAdmin = await checkIfBotIsAdmin(sock, message.key.remoteJid);
					if (isBotAdmin) {

						if (text.startsWith(`${prf}admin`)) {

							var isBotAdmin = await checkIfBotIsAdmin(sock, message.key.remoteJid);
							console.log(isBotAdmin);
							return;

						} else if (text.startsWith(`${prf}add`)) {
							if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
								var chatId = message.key.remoteJid;
								if (!chatId.includes('@g.us')) {sock.sendMessage(message.key.remoteJid, { text: 'Bu komut sadece gruplarda kullanılabilir.'}); return;}
								var quotedMessage = message.message.extendedTextMessage.contextInfo;
								var partId = quotedMessage.participant;
								var isInGroup = await checkUserInGroup(sock, chatId, partId);
								if (!isInGroup) {
									await replaceUserPosition(sock, chatId, partId, 'add');
									sock.sendMessage(message.key.remoteJid, { text: 'Kullanıcı gruba eklendi'});
									return;
								}
								else {
									sock.sendMessage(message.key.remoteJid, { text: 'Kullanıcı zaten grupta'});
									return;
								}
							} else if (text.includes(`${prf}add `)) {
								console.log('bekleniyor');
								var addIds = text.replace(`${prf}add `, '');
								var addId = `${addIds}@s.whatsapp.net`;
								var groupId = message.key.remoteJid;
								await replaceUserPosition(sock, groupId, addId, 'add');
								sock.sendMessage(message.key.remoteJid, { text: 'Kullanıcı gruba eklendi'});
								return;
							} else {
								sock.sendMessage(message.key.jid, { text: 'Lütfen bir kullanıcı numarası yazın veya mesajına yanıt verin.'});
								return;
							}

						} else if (text.startsWith(`${prf}ban`)) {
							if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
								var chatId = message.key.remoteJid;
								if (!chatId.includes('@g.us')) {sock.sendMessage(message.key.remoteJid, { text: 'Bu komut sadece gruplarda kullanılabilir.'}); return;}
								var quotedMessage = message.message.extendedTextMessage.contextInfo;
								var partId = quotedMessage.participant;
								var isInGroup = await checkUserInGroup(sock, chatId, partId);
								if (isInGroup) {
									await replaceUserPosition(sock, chatId, partId, 'remove');
									sock.sendMessage(message.key.remoteJid, { text: 'Kullanıcı gruptan çıkarıldı.'});
									return;
								}
								else {
									sock.sendMessage(message.key.remoteJid, { text: 'Kullanıcı zaten grupta değil'});
									return;
								}

							} else if (text.includes(' @')) {
								var liste = text.split('@');
								var len = liste.length;
								//console.log(len, '\n\n', liste);
								if (len > 2) {sock.sendMessage(message.key.remoteJid, { text: 'Tek seferde sadece 1 kişiyi banlayabilirsiniz.'}); return;}
								console.log('bekleniyor');
								var banIds = text.replace(`${prf}ban @`, '');
								var banId = `${banIds}@s.whatsapp.net`;
								var groupId = message.key.remoteJid;
								await replaceUserPosition(sock, groupId, banId, 'remove');
								sock.sendMessage(message.key.remoteJid, { text: 'Kullanıcı gruptan çıkarıldı.'});
								return;

							} else {
								sock.sendMessage(message.key.remoteJid, { text: 'Lütfen bir kişiyi etiketleyin yada yanıt verin.'});
								return;
							}
						} else if (text.startsWith(`${prf}promote`)) {
							if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
								var groupId = message.key.remoteJid;
								var quotedMessage = message.message.extendedTextMessage.contextInfo;
								var partId = quotedMessage.participant;
								var isUserAdmin = await checkIsAdmin(sock, groupId, partId);
								if (isUserAdmin) { sock.sendMessage(message.key.remoteJid, { text: 'Kullanıcı zaten yönetici.'});return;}
								var isInGroup = await checkUserInGroup(sock, groupId, partId);
								if (!isInGroup) { sock.sendMessage(message.key.remoteJid, { text: 'Kullanıcı grupta değil'});return;}
								await replaceUserPosition(sock, groupId, partId, 'promote');
								sock.sendMessage(message.key.remoteJid, { text: 'Kullanıcı yönetici yapıldı.'});
								return;
							} else if (text.includes(` @`)) {
								var liste = text.split('@');
								var len = liste.length;
								if (len > 2) { sock.sendMessage(message.key.remoteJid, { text: 'Tek seferde sadece 1 kişiyi Yönetici yapabilirisiniz.'});return;}
								console.log('bekleniyor');
								var proIds = text.replace(`${prf}promote @`, '');
								var proId = `${proIds}@s.whatsapp.net`;
								var groupId = message.key.remoteJid;
								await replaceUserPosition(sock, groupId, proId, 'promote');
								sock.sendMessage(message.key.remoteJid, { text: 'Kullanıcı yönetici yapıldı.'});
								return;
							} else { sock.sendMessage(message.key.remoteJid, { text: 'Lütfen bir kişiyi etiketleyin yada yanıt verin.'});return;}
						} else if (text.startsWith(`${prf}demote`)) {
							if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
								var groupId = message.key.remoteJid;
								var quotedMessage = message.message.extendedTextMessage.contextInfo;
								var partId = quotedMessage.participant;
								var isUserAdmin = await checkIsAdmin(sock, groupId, partId);
								if (!isUserAdmin) { sock.sendMessage(message.key.remoteJid, { text: 'Kullanıcı zaten yönetici değil.'});return;}
								var isInGroup = await checkUserInGroup(sock, groupId, partId);
								if (!isInGroup) { sock.sendMessage(message.key.remoteJid, { text: 'Kullanıcı grupta değil'});return;}
								await replaceUserPosition(sock, groupId, partId, 'demote');
								sock.sendMessage(message.key.remoteJid, { text: 'Kullanıcının yöneticiliği alındı.'})
								return;
							} else if (text.includes(` @`)) {
								var liste = text.split('@');
								var len = liste.length;
								if (len > 2) { sock.sendMessage(message.key.remoteJid, { text: 'Tek seferde sadece 1 kişiyi Yöneticilikten çıkarabilirsiniz.'});return;}
								console.log('bekleniyor');
								var proIds = text.replace(`${prf}promote @`, '');
								var proId = `${proIds}@s.whatsapp.net`;
								var groupId = message.key.remoteJid;
								await replaceUserPosition(sock, groupId, proId, 'demote');
								sock.sendMessage(message.key.remoteJid, { text: 'Kullanıcının yöneticiliği alındı.'});
								return;
							} else { sock.sendMessage(message.key.remoteJid, { text: 'Lütfen bir kişiyi etiketleyin yada yanıt verin.'});return;}
						} 
					} else {sock.sendMessage(message.key.remoteJid, { text: 'Bu komutu kullanabilmem için admin olmam gerekir.'});return;}
				} else {sock.sendMessage(message.key.remoteJid, { text: 'Bu komut sadece gruplarda kullanılabilir.'});return;}
				/* User and Sudo commands */
			} else if (
				text === `${prf}imagealive` ||
				text.startsWith(`${prf}tagall`) ||
				text.startsWith(`${prf}setvar_`) ||
				text.startsWith(`${prf}googlesearch`) ||
				text.startsWith(`${prf}getvar_`)
			) {
				var chId = message.key.participant;
				let usId = message.key.remoteJid;
				if (usId.includes('@g.us')) { usId = message.key.participant;}
				var fromMe = message.key.fromMe;
				let onay = false;
				if (!fromMe) {
					for (const i of convertSudo) {
						if (i === usId) {
							onay = true;
						}
					}
				}
				/* ---- always sudo and fromMe command ---- */
				if (!fromMe && !onay) return;
				if (text.startsWith(`${prf}tagall`)) {
					var msj = text.replace(`${prf}tagall`, '');
					try {
						if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
							const quotedMessage = message.message.extendedTextMessage.contextInfo.quotedMessage;
							const dirname = path.join(__dirname, '..', 'assets');
							const paths = `${dirname}\\file.png`; 
							if (quotedMessage.imageMessage) {
								const isGroup = message.key.remoteJid.endsWith('@g.us');
								if (!isGroup) {
									await sock.sendMessage(message.key.remoteJid, { text: 'Bu komut sadece grup sohbetlerinde kullanılabilir.' });
									return;
							  	}
								const buffer = await downloadMediaMessage(
									{ message: quotedMessage },
									'buffer',
									{},
									{
										logger: console,
										reuploadRequest: sock.updateMediaMessage
									}
								);
							  	const groupMetadata = await sock.groupMetadata(message.key.remoteJid); 
							  	const participants = groupMetadata.participants.map(participant => participant.id); 
								fs.writeFileSync(paths, buffer);
								var imagepath = fs.readFileSync(paths);
								sock.sendMessage(message.key.remoteJid, { image: imagepath, mentions: participants});
							} else if (quotedMessage.stickerMessage) {
								const buffer = await downloadMediaMessage(
									{ message: quotedMessage },
									'buffer',
									{},
									{
										logger: console,
										reuploadRequest: sock.updateMediaMessage
									}
								);
								const aspath = path.join(__dirname, '..', 'assets');
								const save = `${aspath}\\sticker.webp`;
								const groupMetadata = await sock.groupMetadata(message.key.remoteJid); 
								const participants = groupMetadata.participants.map(participant => participant.id); 
								fs.writeFileSync(save, buffer);
								sock.sendMessage(message.key.remoteJid, { sticker: fs.readFileSync(save), mentions: participants});
							} else if (quotedMessage.videoMessage) {
								const quotedMessage = message.message.extendedTextMessage.contextInfo.quotedMessage;
								const dirname = path.join(__dirname, '..', 'assets');
								const paths = `${dirname}\\file.mp4`; 
								const isGroup = message.key.remoteJid.endsWith('@g.us');
								if (!isGroup) {
									await sock.sendMessage(message.key.remoteJid, { text: 'Bu komut sadece grup sohbetlerinde kullanılabilir.' });
									return;
								}
								const buffer = await downloadMediaMessage(
									{ message: quotedMessage },
									'buffer',
									{},
									{
										logger: console,
										reuploadRequest: sock.updateMediaMessage
									}
								);
								const groupMetadata = await sock.groupMetadata(message.key.remoteJid); 
								const participants = groupMetadata.participants.map(participant => participant.id); 
								fs.writeFileSync(paths, buffer);
								var videopath = fs.readFileSync(paths);
								sock.sendMessage(message.key.remoteJid, { video: videopath, mentions: participants});
							} else {
								console.log('text mevcut.');
								const isGroup = message.key.remoteJid.endsWith('@g.us');
								if (!isGroup) {
									await sock.sendMessage(message.key.remoteJid, { text: 'Bu komut sadece grup sohbetlerinde kullanılabilir.' });
									return;
								}
								const groupMetadata = await sock.groupMetadata(message.key.remoteJid); 
								const participants = groupMetadata.participants.map(participant => participant.id); 
								const finalMessage = `*${quotedMessage.conversation}*`; 
				
								await sock.sendMessage(message.key.remoteJid, {
									text: finalMessage,
									mentions: participants 
								});
							}
						} else {
							if (msj === ' ' || msj === '') {
								try {
									const isGroup = message.key.remoteJid.endsWith('@g.us');
									if (!isGroup) {
										  await sock.sendMessage(message.key.remoteJid, { text: 'Bu komut sadece grup sohbetlerinde kullanılabilir.' });
										  return;
									}
									const groupMetadata = await sock.groupMetadata(message.key.remoteJid); 
									const participants = groupMetadata.participants.map(participant => participant.id); 
									const mentions = participants.map(participant => `• @${participant.split('@')[0]}`).join('\n'); 
									const finalMessage = `${mentions}`;
							  
									await sock.sendMessage(message.key.remoteJid, {
										  text: finalMessage,
										  mentions: participants 
									});
								} catch (error) {
									console.error('tagall komutunda hata:', error);
								}
							} else {
								try {
									const isGroup = message.key.remoteJid.endsWith('@g.us');
									if (!isGroup) {
										await sock.sendMessage(message.key.remoteJid, { text: 'Bu komut sadece gruplarda kullanılabilir.' });
										return;
									}
							
									const messageText = message.message.conversation || message.message.extendedTextMessage?.text; 
									const groupMetadata = await sock.groupMetadata(message.key.remoteJid); 
									const participants = groupMetadata.participants.map(participant => participant.id); 
									const mesj = text.replace(`${prf}tagall `, '');
									const finalMessage = `*${mesj}*`; 
					
									await sock.sendMessage(message.key.remoteJid, {
										text: finalMessage,
										mentions: participants 
									});
								} catch (error) {
									console.error('tagall komutunda hata:', error);
								}
							}
						}
					} catch (error) {
						console.error('tagall komutunda hata:', error);
					}
				} else if (text === `${prf}imagealive`) {
					if (!message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
						await sock.sendMessage(message.key.remoteJid, { text: 'Lütfen bir medya mesajına yanıt verin.' });
						return;
					}
					sock.sendMessage(message.key.remoteJid, { text: 'Media indiriliyor lütfen bekleyiniz...'});
					var asspath = path.join(__dirname, '..', 'assets');
					var imagepath = `${asspath}\\aliveimage.png`;
					const quotedMessage = message.message.extendedTextMessage.contextInfo.quotedMessage;
					const quotedMessageType = Object.keys(quotedMessage)[0];
					if (quotedMessageType === 'imageMessage') {
						const buffer = await downloadMediaMessage(
							{ message: quotedMessage },
							'buffer',
							{},
							{
								logger: console,
								reuploadRequest: sock.updateMediaMessage
							}
						);
						fs.writeFileSync(imagepath, buffer);
						sock.sendMessage(message.key.remoteJid, { text: 'Media indirildi artık: {image} argümanı ile alive mesajınızda kullanabilirsiniz.'});
					}
				} else if (text.startsWith(`${prf}setvar_ALIVEMSG`)) {
					if (!text.includes(' '))return;
					var newarg = text.replace(`${prf}setvar_ALIVEMSG `, '');
					await updateValueInConfig(newarg, 'ALIVEMSG');
					sock.sendMessage(message.key.remoteJid, { text: `_ALIVEMSG_ *${newarg}* _olarak güncellendi_`});
					await reloadConfig();
					return;
				} else if (text.startsWith(`${prf}setvar_WORKTYPE`)) {
					if (!text.includes(' '))return;
					var newarg = text.replace(`${prf}setvar_WORKTYPE `, '');
					await updateValueInConfig(newarg, 'WORKTYPE');
					sock.sendMessage(message.key.remoteJid, { text: `_Worktype_ *${newarg}* _olarak güncellendi_`});
					await reloadConfig();
					return;
				} else if (text.startsWith(`${prf}setvar_SUDOUSER`)) {
					if (!text.includes(' '))return;
					var newarg = text.replace(`${prf}setvar_SUDOUSER `, '');
					await updateArrayInConfig(newarg, 'SUDOUSER');
					sock.sendMessage(message.key.remoteJid, { text: `_Sudo User_ *${newarg}* _olarak güncellendi_`});
					await reloadConfig();
					return;
				} else if (text.startsWith(`${prf}setvar_HANDLERS`)) {
					if (!text.includes(' '))return;
					var newarg = text.replace(`${prf}setvar_HANDLERS `, '');
					await updateArrayInConfig(newarg, 'HANDLERS');
					sock.sendMessage(message.key.remoteJid, { text: `_Handlers_ *${newarg}* _olarak güncellendi_`});
					await reloadConfig();
					return;
				} else if (text.startsWith(`${prf}getvar_`)) {
					var arg = text.replace(`${prf}getvar_`, '')
					console.log(arg);
					let msj =  '';
					switch (arg) {
						case 'SUDOUSER':
							msj = config.SUDOUSER;
							break;
						case 'HANDLERS':
							msj = config.HANDLERS;
							break;
						case 'ALIVEMSG':
							msj = config.ALIVEMSG;
							break;
						case 'WORKTYPE':
							msj = config.WORKTYPE;
							break;
						default:
							msj = 'Girilen argüman config dosyasında bulunamadı.';
					}
					sock.sendMessage(message.key.remoteJid, { text: `${msj}`});
				} 
			}
		}
	}
};
function getMediaType(quotedMessage) {
    if (quotedMessage.imageMessage) return 'imageMessage';
    if (quotedMessage.videoMessage) return 'videoMessage';
    if (quotedMessage.audioMessage) return 'audioMessage';
    return null;
}

function getFileExtension(mimetype) {
    switch (mimetype) {
        case 'image/jpeg': return 'jpg';
        case 'image/png': return 'png';
        case 'video/mp4': return 'mp4';
        case 'audio/mp4': return 'mp4';
        default: return 'bin'; 
    }
}
