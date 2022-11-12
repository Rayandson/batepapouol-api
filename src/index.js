import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb";
import joi from "joi";
import dayjs from "dayjs";

const participantesSchema = joi.object({
    name: joi.string().required()
})
const mensagensSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid("message", "private_message").required(),
    from: joi.required()
})



// console.log((dayJsObject.format('hh:mm:ss'))

const app = express();
app.use(cors());
app.use(express.json());
const mongoClient = new MongoClient("mongodb://localhost:27017") 
let db;

try {
    await mongoClient.connect();
    db = mongoClient.db("batepapouol")
} catch {
    console.log("erro de conexão")
}


app.post("/participantes", async (req, res) => {
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
    try {
        const messages = await db.collection("mensagens").find().toArray()
        res.status(200).send(messages)
    } catch {
        res.sendStatus(500)
    }
    
})

app.post("/status", async (req, res) => {
    const user = await db.collection("participantes").findOne({name: req.headers.user})
    if(!user) {
        res.sendStatus(404)
        return
    }
    await db.collection("status").insertOne("")
})



app.listen(5000, () => console.log("app running in port 5000"))