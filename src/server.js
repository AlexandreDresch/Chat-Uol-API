import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import Joi from "joi";
import dayjs from "dayjs";
import dotenv from "dotenv";

dotenv.config();

const server = express();

server.use(cors());

server.use(express.json());

const PORT = 5000;

const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

const timeData = dayjs();

try {
  await mongoClient.connect();
  db = mongoClient.db();
} catch (error) {
  console.log(error);
}

const signupSchema = Joi.object({
  name: Joi.string().alphanum().min(1).required(),
});

const messageSchema = Joi.object({
  to: Joi.string().alphanum().min(1).required(),
  text: Joi.string().alphanum().min(1).required(),
  type: Joi.string()
    .alphanum()
    .min(1)
    .required()
    .valid("message", "private_message"),
});

const userSchema = Joi.object({
  User: Joi.string().alphanum().min(1).required,
});

server.post("/participants", async (req, res) => {
  const { error, value } = signupSchema.validate(req.body);

  if (error) {
    console.log(error);
    return res.sendStatus(422);
  }

  try {
    const userIsTaken = await db
      .collection("participants")
      .findOne({ name: value.name });

    if (userIsTaken) {
      return res.sendStatus(409);
    }

    await db.collection("participants").insertOne({
      name: value.name,
      lastStatus: timeData.valueOf(),
    });

    await db.collection("messages").insertOne({
      from: value.name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: timeData.format("HH:mm:ss"),
    });

    res.sendStatus(201);
  } catch (error) {
    console.log(error);
  }
});

server.get("/participants", async (req, res) => {
  try {
    const participants = await db.collection("participants").find().toArray();
    return res.send(participants);
  } catch (error) {
    console.log(error);
    return res.sendStatus(500);
  }
});

server.post("/messages", async (req, res) => {
  const { error, value } = userSchema.validate(req.headers);
  const { error2, value2 } = messageSchema.validate(req.body);

  if (error || error2) {
    return res.sendStatus(422);
  }

  const userExists = await db
      .collection("participants")
      .findOne({ name: value2.name });

    if (!userExists) {
      return res.sendStatus(409);
    }

  try {
    await db.collection("messages").insertOne({
      from: value.User,
      to: value2.to,
      text: value2.text,
      type: value2.type,
      time: timeData.format("HH:mm:ss"),
    });

    res.sendStatus(201);
  } catch (error) {
    console.log(error);
    return res.sendStatus(422);
  }
});

server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
