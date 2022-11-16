import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb";
import joi from "joi";
import dayjs from "dayjs";
import dotenv from "dotenv";

const participantesSchema = joi.object({
    name: joi.string().required()
})
const mensagensSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid("message", "private_message").required(),
    from: joi.required()
})

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
const mongoClient = new MongoClient(process.env.MONGO_URI) 
let db;

try {
    await mongoClient.connect();
    db = mongoClient.db("batepapouol")
} catch {
    console.log("erro de conexão")
}


app.post("/participants", async (req, res) => {
    const dayJsObject = dayjs();
    const validation = participantesSchema.validate(req.body, { abortEarly: false })
    const { name } = req.body;
    if (validation.error) {
        res.status(422).send(validation.error.details)
        return
      }
    const usuario = await db.collection("participantes").findOne({ name: name })
    if(usuario) {
        res.sendStatus(409)
        return
    }
    try {
        await db.collection("participantes").insertOne({name: name, lastStatus: Date.now()})
        await db.collection("mensagens").insertOne({from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayJsObject.format('hh:mm:ss')})
        res.sendStatus(201)
    } catch {
        res.sendStatus(500)
    }    
})

app.get("/participants", async (req, res) => {
    try {
        const participantes = await db.collection("participantes").find().toArray()
        res.status(201).send(participantes)
    } catch {
        res.sendStatus(500)
    }
    
})

app.post("/messages", async (req, res) => {
    const mensagem = {
        from: req.headers.user,
        ...req.body
    }
    const dayJsObject = dayjs();
    const validation = mensagensSchema.validate(mensagem, { abortEarly: false })
    if(validation.error) {
        res.status(422).send(validation.error.details)
        return
    }
    const participante = db.collection("participantes").findOne({name: req.headers.user})
    if(participante) {
        try {
            await db.collection("mensagens").insertOne({...mensagem, time: dayJsObject.format('hh:mm:ss')})
            res.sendStatus(201)
        } catch {
            res.status(500)
        }
    } else {
        res.sendStatus(422)
    }
})

app.get("/messages", async (req, res) => {
    const limit = parseInt(req.query.limit)
    const user = req.headers.user
    if(limit) {
        try {
            const messages = await db.collection("mensagens").find({$or: [{to: user, type: "private_message"},{type:"message"} ]}).toArray()
            res.status(200).send(messages.slice(0,limit))
        } catch {
            res.sendStatus(500)
        }
    }
    else {
        try {
            const messages = await db.collection("mensagens").find({$or: [{to: user, type: "private_message"},{type:"message"} ]}).toArray()
            res.status(200).send(messages)
        } catch {
            res.sendStatus(500)
        }
    }
   
    
})

app.post("/status", async (req, res) => {
    const user = await db.collection("participantes").findOne({name: req.headers.user})
    
    if(!user) {
        res.sendStatus(404)
        return
    }
    try {
        await db.collection("participantes").updateOne({name: user.name},{$set: {lastStatus: Date.now()}})
        res.sendStatus(200)
    } catch {
        res.sendStatus(400)
    }
})

async function IdentificarInativos() {
    let mensagensStatus = []
    const dayJsObject = dayjs();
    try {
        const inativos = await db.collection("participantes").find({lastStatus: {$lt: Date.now() - 10000}}).toArray()
        await db.collection("participantes").deleteMany({lastStatus: {$lt: Date.now() - 10000}})
        inativos.forEach((i) => {
            mensagensStatus.push({from: i.name, to: 'Todos', text: 'sai da sala...', type: 'status', time: dayJsObject.format('hh:mm:ss')})
            console.log(mensagensStatus)
        })
        console.log(mensagensStatus)
        await db.collection("mensagens").insertMany(mensagensStatus)
    } catch {
        console.log("0 participantes inativos")             
    }
}     

setInterval(IdentificarInativos, 15000)

app.listen(5000, () => console.log("app running in port 5000"))