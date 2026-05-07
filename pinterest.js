const axios = require('axios')
const { generateWAMessageFromContent, proto } = require('zerotwo')
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const API = 'https://rynekoo-api.hf.space/discovery/pinterest/search'

const pluginConfig = {
    name: 'pin',
    alias: ['pinterest'],
    category: 'search',
    description: 'Cari gambar dari Pinterest (Carousel/Swipe)',
    usage: '.pin <query>|<jumlah>',
    example: '.pin zero two|5',
    cooldown: 5,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    let input = m.text?.trim()

    if (!input) {
        return m.reply(
`╭━━━〔 ❤️ ZERO TWO PINTEREST ❤️ 〕━━━⬣
┃ Hai Darling~
┃ Kirim kata kunci ya 💗
┃
┃ Contoh:
┃ .pin zero two
┃ .pin zero two|5
┃
┃ Max 5 gambar (Bisa di-swipe!)
╰━━━━━━━━━━━━━━━━⬣`)
    }

    let [query, jumlah] = input.split('|')
    query = query.trim()
    jumlah = parseInt(jumlah) || 1
    if (jumlah > 5) jumlah = 5
    if (jumlah < 1) jumlah = 1

    await m.react('🔍')

    try {
        const { data } = await axios.get(API, {
            params: { q: query },
            timeout: 10000
        })

        if (!data?.result?.length) {
            return m.reply(
`╭━━━〔 ❌ ZERO TWO ERROR ❌ 〕━━━⬣
┃ Maaf Darling~
┃ Gambar "${query}" tidak ditemukan 💧
┃ Coba kata kunci lain ya~
╰━━━━━━━━━━━━━━━━⬣`)
        }

        const results = data.result
        const shuffled = results.sort(() => 0.5 - Math.random())
        const selected = shuffled.slice(0, jumlah)

        // Prepare carousel cards
        const carouselCards = []
        
        for (let i = 0; i < selected.length; i++) {
            const img = selected[i]
            let url = img.imageUrl || img.url || img.image
            if (!url) continue
            
            const caption = img.caption || 'No caption'
            const author = img.author?.name || 'Unknown'
            const followers = img.author?.followers || 0
            
            // Download & resize image for carousel
            let imageBuffer = null
            try {
                const imgResponse = await axios.get(url, { 
                    responseType: 'arraybuffer',
                    timeout: 15000
                })
                imageBuffer = Buffer.from(imgResponse.data)
                
                // Resize to 300x300 for carousel
                imageBuffer = await sharp(imageBuffer)
                    .resize(300, 300, { fit: 'cover' })
                    .jpeg({ quality: 80 })
                    .toBuffer()
                    
            } catch (err) {
                console.error(`Failed to process image ${i}:`, err.message)
                continue
            }
            
            const { prepareWAMessageMedia } = require('zerotwo')
            const cardMedia = await prepareWAMessageMedia({
                image: imageBuffer
            }, { upload: sock.waUploadToServer })
            
            const cardBody = 
`╭─〔 📌 PINTEREST IMAGE 〕
│ 📝 *Caption:* ${caption.substring(0, 50)}${caption.length > 50 ? '...' : ''}
│ 👤 *Author:* ${author}
│ 📊 *Followers:* ${followers}
│ 🖼️ *Image ${i+1}/${selected.length}*
╰──────────────`

            const cardMessage = {
                header: proto.Message.InteractiveMessage.Header.fromObject({
                    title: `📌 ${query.toUpperCase()} - ${i+1}/${selected.length}`,
                    hasMediaAttachment: true,
                    ...cardMedia
                }),
                body: proto.Message.InteractiveMessage.Body.fromObject({
                    text: cardBody
                }),
                footer: proto.Message.InteractiveMessage.Footer.create({
                    text: `✨ Zero Two Pinterest • Swipe untuk gambar selanjutnya ✨`
                }),
                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                    buttons: [{
                        name: 'quick_reply',
                        buttonParamsJson: JSON.stringify({
                            display_text: `💾 Simpan Gambar ${i+1}`,
                            id: `${m.prefix}getimg ${url}`
                        })
                    }]
                })
            }
            
            carouselCards.push(cardMessage)
        }
        
        if (carouselCards.length === 0) {
            return m.reply('❌ Gagal memuat gambar, coba lagi nanti Darling~')
        }
        
        const headerText = 
`╭━━━〔 💗 ZERO TWO PINTEREST CAROUSEL 💗 〕━━━⬣
┃ 🔎 *Query:* ${query}
┃ 🖼️ *Total:* ${carouselCards.length} gambar ditemukan
┃
┃ ✨ *Geser ke samping (swipe left/right)* ✨
┃ 💕 Untuk melihat gambar lainnya, Darling~
╰━━━━━━━━━━━━━━━━⬣`

        const msg = await generateWAMessageFromContent(m.chat, {
            viewOnceMessage: {
                message: {
                    messageContextInfo: {
                        deviceListMetadata: {},
                        deviceListMetadataVersion: 2
                    },
                    interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                        body: proto.Message.InteractiveMessage.Body.fromObject({
                            text: headerText
                        }),
                        footer: proto.Message.InteractiveMessage.Footer.fromObject({
                            text: `✨ Zero Two Pinterest v1.0 | “Nikmati gambarnya, Darling~” ✨`
                        }),
                        carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({
                            cards: carouselCards
                        })
                    })
                }
            }
        }, {
            userJid: m.sender
        })
        
        await sock.relayMessage(m.chat, msg.message, {
            messageId: msg.key.id
        })
        
        await m.react('💗')

    } catch (e) {
        console.log("Pinterest Carousel Error:", e.message)
        
        let errorMsg = e.message
        if (e.code === 'ECONNABORTED') {
            errorMsg = 'Timeout koneksi, API lambat'
        } else if (e.response?.status === 404) {
            errorMsg = 'API endpoint tidak ditemukan (404)'
        } else if (e.code === 'ENOTFOUND') {
            errorMsg = 'Domain API tidak bisa diakses'
        }
        
        m.reply(
`╭━━━〔 ❌ ZERO TWO ERROR ❌ 〕━━━⬣
┃ Darling~ Ada masalah ni 💧
┃
┃ Error: ${errorMsg}
┃
┃ Coba lagi nanti ya~
╰━━━━━━━━━━━━━━━━⬣`)
    }
}

module.exports = {
    config: pluginConfig,
    handler
}