import TelegramBot from 'node-telegram-bot-api'
import agent from 'superagent'
import use from 'superagent-use'
import promise from 'superagent-promise'
import { error } from 'winston'
import dashbot from 'dashbot'

const request = use(promise(agent, Promise))
const pearsonBase = 'https://api.pearson.com/v2' 
const dashbotBase = 'https://tracker.dashbot.io'
const { TELEGRAM_BOT_TOKEN, DASHBOT_KEY } = process.env
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true })
const sessions = {}

const introduction = 
`Hi! I'm Dexter Miguel's dictionary bot! You can use me to define words for you! Here's the syntax to my one command: 

\`/define (keyword)\`

It'll find the most common definitions for words. For instance, if you're wondering what the definition of *mocassins* is, you can type: \`/define mocassins\`. Go ahead! Try it now!`

bot.onText(/^\/start$/, sendIntroduction)
bot.onText(/^\/define (.+)/, sendDefinition)
bot.onText(/^@DMDictionaryBot define (.+)/, sendDefinition)

function sendIntroduction({ chat: { id, username, title } }, [text]) {
    bot.sendChatAction(id, 'typing')
    recordMessage(text, username || title || id)
    sendMessage(id, introduction, username || title)
}

function sendDefinition({ chat: { id, username, title } }, [text, match]) {
    const searching = sessions[id]
    if (searching) return sendMessage(id, `I'm still looking for *${ search }*!`)
    
    recordMessage(text, username || title || id)

    const name = username || title
    const keyword = sessions[id] = match

    bot.sendChatAction(id, 'typing')

    request
        .get(`${ pearsonBase }/dictionaries/ldoce5/entries`)
        .query({ headword: match })
        .then(({ body: { total = 0, results = [] } = {} }) => {
            if (!total || !results.length) {
                sendMessage(id, `I couldn't find a definition for *${ keyword }*. Sorry!`, name)
                return
            }

            const definition = results[0].senses[0].definition[0]

            sendMessage(id, `Here's the definition I found for *${ keyword }*.\n\n${ definition }`, name)
            sessions[id] = undefined
        })
        .catch((err) => {
            error(err)

            sendMessage(id, `Oh no! My internals are fried! Something went horribly `+ 
                `wrong and I've let Dexter know.`, name)

            sessions[id] = undefined
        })
}

function sendMessage(id, text, user) {
    bot.sendMessage(id, text, { parse_mode: "Markdown" })
    return recordMessage(text, user, 'outgoing')
}

function recordMessage(text, user, type = 'incoming') {
    return request
        .post(`${ dashbotBase }/track`)
        .query({
            platform: 'generic',
            type: type,
            apiKey: DASHBOT_KEY
        })
        .send({ text, userId: user })
        .end()
        .catch(error)
}