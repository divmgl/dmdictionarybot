import TelegramBot from 'node-telegram-bot-api'
import agent from 'superagent'
import use from 'superagent-use'
import promise from 'superagent-promise'
import { error } from 'winston'
import dashbot from 'dashbot'

global.request = use(promise(agent, Promise))

const pearsonBase = 'https://api.pearson.com/v2' 
const dashbotBase = 'https://tracker.dashbot.io'
const token = process.env.BOT_TOKEN
const dashbotKey = process.env.DASHBOT_KEY
const bot = new TelegramBot(token, { polling: true })
const chatBusyness = {}

const introduction = "Hi! I'm Dexter Miguel's dictionary bot! You can " + 
    "use me to define words for you! Here's the syntax to my one command: " +
    "\n\n `/define (keyword)\` \n\n" + 
    "It'll find the most common definitions for words. For instance, if " +
    "you're wondering what the definition of \"mocassins\" is, you can type: " +
    "`/define mocassins`. Go ahead! Try it now!"

bot.onText(/^\/start$/, (message) => {
    const id = message.chat.id
    const name = message.chat.username || message.chat.title
    sendMessage(id, introduction, name)
})

bot.onText(/^\/define (.+)/, define)
bot.onText(/^@DMDictionaryBot define (.+)/, define)
bot.on('message', (message) => {
    recordMessage(message.text, message.chat.username || message.chat.title || message.chat.id)
})

function define(message, [fullText, match]) {
    const id = message.chat.id
    const name = message.chat.username || message.chat.title

    if (chatBusyness[id]) return bot.sendMessage(
        id, 
        `I'm still looking for *${ chatBusyness[id] }*!`, 
        { parse_mode: "Markdown" }
    )

    const keyword = chatBusyness[id] = match

    bot.sendChatAction(id, 'typing')

    request
        .get(`${ pearsonBase }/dictionaries/ldoce5/entries`)
        .query({
            headword: match
        })
        .then(({ body: { total = 0, results = [] } = {} }) => {
            if (!total || !results.length) {
                sendMessage(id, `I couldn't find a definition for *${ keyword }*. Sorry!`, name)
                return
            }

            const definition = results[0].senses[0].definition[0]

            sendMessage(id, `Here's the definition I found for *${ keyword }*.\n\n${ definition }`, name)
            chatBusyness[id] = undefined
        })
        .catch((err) => {
            error(err)

            sendMessage(id, `Oh no! My internals are fried! Something went horribly `+ 
                `wrong and I've let Dexter know.`, name)

            chatBusyness[id] = undefined
        })
}

function sendMessage(id, text, user) {
    bot.sendMessage(id, text, {
        parse_mode: "Markdown"
    })
    if (user)
    return recordMessage(text, user, 'outgoing')
}

function recordMessage(text, user, type = 'incoming') {
    return request
        .post(`${ dashbotBase }/track`)
        .query({
            platform: 'generic',
            type: type,
            apiKey: dashbotKey
        })
        .send({
            text,
            userId: user
        })
        .end()
        .catch((err) => {
            error(err)
        })
}