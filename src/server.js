import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import { stripHtml } from "string-strip-html";
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
  text: Joi.string().min(1).invalid(" ").required(),
  type: Joi.string()
    .alphanum()
    .min(1)
    .required()
    .valid("message", "private_message"),
});

setInterval(async () => {
  try {
    const allUsers = await db.collection("participants").find().toArray();

    for (let user of allUsers) {
      if (dayjs().valueOf() - user.lastStatus > 10000) {
        await db.collection("participants").deleteOne({ _id: user._id });
        await db.collection("messages").insertOne({
          from: user.name,
          to: "Todos",
          text: "sai da sala...",
          type: "status",
          time: timeData.format("HH:mm:ss"),
        });
      }
    }
  } catch (error) {
    console.log(error);
  }
}, 15000);

server.post("/participants", async (req, res) => {
  const { error, value } = signupSchema.validate(req.body);

  if (error) {
    console.log(error);
    return res.sendStatus(422);
  }

  const name = stripHtml(value.name).result.trim();

  try {
    const userIsTaken = await db
      .collection("participants")
      .findOne({ name: name });

    if (userIsTaken) {
      return res.sendStatus(409);
    }

    await db.collection("participants").insertOne({
      name: name,
      lastStatus: timeData.valueOf(),
    });

    await db.collection("messages").insertOne({
      from: name,
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
  const { user } = req.headers;
  const { error, value } = messageSchema.validate(req.body);

  if (error || !user) {
    console.log(error);
    return res.sendStatus(422);
  }

  const from = stripHtml(user).result.trim();
  const to = stripHtml(value.to).result.trim();
  const text = stripHtml(value.text).result.trim();
  const type = stripHtml(value.type).result.trim();

  const userExists = await db
    .collection("participants")
    .findOne({ name: user });

  if (!userExists) {
    return res.sendStatus(422);
  }

  try {
    await db.collection("messages").insertOne({
      from,
      to,
      text,
      type,
      time: timeData.format("HH:mm:ss"),
    });

    res.sendStatus(201);
  } catch (error) {
    console.log(error);
    return res.sendStatus(422);
  }
});

server.get("/messages", async (req, res) => {
  const { limit } = req.query;
  const { user } = req.headers;

  if (limit !== undefined) {
    const validateLimit = !!limit && +limit > 0 && Number.isInteger(+limit);
    if (!validateLimit) {
      return res.sendStatus(422);
    }
  }

  try {
    const messages = await db
      .collection("messages")
      .find({
        $or: [{ from: user }, { to: "Todos" }, { to: user }],
      })
      .toArray();
    if (limit === undefined) {
      return res.send(messages);
    } else {
      const limitedMessages = [...messages].slice(-limit).reverse();
      return res.send(limitedMessages);
    }
  } catch (error) {
    console.log(error);
    return res.sendStatus(500);
  }
});

server.post("/status", async (req, res) => {
  const { user } = req.headers;

  try {
    const isUserOnline = await db
      .collection("participants")
      .findOne({ name: user });

    if (isUserOnline) {
      await db
        .collection("participants")
        .updateOne(
          { _id: isUserOnline._id },
          { $set: { lastStatus: dayjs().valueOf() } }
        );
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

server.delete("/messages/:id", async (req, res) => {
  const { id } = req.params;
  const { user } = req.headers;

  try {
    const messages = await db.collection("messages");

    const messageFromUser = await messages.findOne({ _id: ObjectId(id) });

    if (!messageFromUser) {
      return res.sendStatus(404);
    }

    if (messageFromUser.from !== user) {
      return res.sendStatus(401);
    }

    await messages.deleteOne({ _id: ObjectId(id) });

    res.sendStatus(200);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

server.put("/messages/:id", async (req, res) => {
  const { user } = req.headers;
  const { id } = req.params;

  const { error, value } = messageSchema.validate(req.body);

  if (error || !user) {
    console.log(error);
    return res.sendStatus(422);
  }

  const userExists = await db
    .collection("participants")
    .findOne({ name: user });

  if (!userExists) {
    return res.sendStatus(422);
  }

  try {
    const messages = await db.collection("messages");

    const messageFromUser = await messages.findOne({ _id: ObjectId(id) });

    if (!messageFromUser) {
      return res.sendStatus(404);
    }

    if (messageFromUser.from !== user) {
      return res.sendStatus(401);
    }

    await messages.updateOne({ _id: ObjectId(id) }, { $set: value });

    res.sendStatus(200);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
