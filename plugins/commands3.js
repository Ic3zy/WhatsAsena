const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
module.exports = {
    handleCommand: async (sock, message) => {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        if (!text) {
            console.log('text yok');
            return;
        }
        
        if (text.startsWith('!sticker')) {
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
        }
    }
};
