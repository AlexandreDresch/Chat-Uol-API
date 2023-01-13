import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import Joi from "joi";
import dotenv from "dotenv";

dotenv.config();

const server = express();

server.use(cors());

server.use(express.json());

const PORT = 5000;

const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

try {
  await mongoClient.connect();
  db = mongoClient.db();
} catch (error) {
  console.log(error);
}

const signupSchema = Joi.object({
  name: Joi.string().alphanum().min(1).required(),
});

server.post("/participants", async (req, res) => {
  const { error, value } = signupSchema.validate(req.body);

  if(error) {
    console.log(error);
    return res.sendStatus(422);
  }

  try {
    const userIsTaken = await db.collection("participants").findOne({name: value});

    if(userIsTaken) {
      return res.sendStatus(409);
    }

    await db.collection("participants").insertOne({
      name: value,
      lastStatus: Date.now(),
    });

    res.sendStatus(201);
  } catch (error) {
    console.log(error);
  }
});

server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
