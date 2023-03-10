const express = require("express");
const app = express();
app.use(express.json());
const Redis = require("ioredis");
const redis = new Redis();
//.ENV
require('dotenv').config();

const { Worker } = require('worker_threads');

//Worker Thread magic
const worker = new Worker('./worker.js');

worker.on('message', message => {
  console.log('Worker message:', message);
});

worker.on('error', error => {
  console.error('Worker error:', error);
});

worker.on('exit', code => {
  console.log('Worker exit:', code);
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});

app.post("/rescueservice", async (req, res) => {
  const { name, lat, long } = req.body;
  if (!name || !lat || !long) {
    res.status(400).send({ error: "Fehlerhafte Anfrage!" });
  }
  await redis.geoadd("rescueservice", long, lat, name);
  res.status(200).send({ message: "Erfolgreich hinzugefügt!" });
});

app.get("/rescueservice/:name", async (req, res) => {
  const pos = await redis.geopos("rescueservice", req.params.name);
  res.status(200).send({ position: pos[0].reverse() });
});

app.get("/rescueservice/:lat/:long/:radius", async (req, res) => {
  const { lat, long, radius } = req.params;
  if (!lat || !long || !radius) {
    res.status(400).send({ error: "Fehlerhafte Anfrage!" });
  }
  await redis.georadius(
    "rescueservice",
    long,
    lat,
    radius,
    "km",
    "WITHDIST",
    "WITHCOORD",
    "ASC",
    function (err, reply) {
      if (err) {
        res.status(500).send({ error: "Ein Fehler ist aufgetreten!" });
      } else {
        res.status(200).send({ locations: reply.map((item) => { return { name: item[0], distance: item[1], position: item[2].reverse() }}) });
      }
    }
  );
});

app.delete("/rescueservice", async (req, res) => {
    await redis.del("rescueservice");
    res.status(200).send({ message: "Erfolgreich gelöscht!" });
    }
);

app.delete("/rescueservice/:name", async (req, res) => {
  const { name } = req.params;
  if (!name) {
    res.status(400).send({ error: "Fehlerhafte Anfrage!" });
  }
  await redis.zrem("rescueservice", name);
  res.status(200).send({ message: "Erfolgreich gelöscht!" });
});