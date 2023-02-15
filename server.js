const express = require("express");
const app = express();
app.use(express.json());
const Redis = require("ioredis");
const redis = new Redis();

app.listen(3000, () => {
  console.log("Server running on port 3000");
});

app.post("/rettungskraft", async (req, res) => {
  const { name, lat, long } = req.body;
  if (!name || !lat || !long) {
    res.status(400).send({ error: "Fehlerhafte Anfrage!" });
  }
  await redis.geoadd("rettungskraefte", long, lat, name);
  res.status(200).send({ message: "Erfolgreich hinzugefügt!" });
});

app.get("/rettungskraft/:lat/:long/:radius", async (req, res) => {
  const { lat, long, radius } = req.params;
  if (!lat || !long || !radius) {
    res.status(400).send({ error: "Fehlerhafte Anfrage!" });
  }
  await redis.georadius(
    "rettungskraefte",
    long,
    lat,
    radius,
    "km",
    "WITHDIST",
    function (err, reply) {
      if (err) {
        res.status(500).send({ error: "Ein Fehler ist aufgetreten!" });
      } else {
        res.status(200).send({ locations: reply });
      }
    }
  );
});

app.delete("/rettungskraft", async (req, res) => {
    await redis.del("rettungskraefte");
    res.status(200).send({ message: "Erfolgreich gelöscht!" });
    }
);

app.delete("/rettungskraft/:name", async (req, res) => {
  const { name } = req.params;
  if (!name) {
    res.status(400).send({ error: "Fehlerhafte Anfrage!" });
  }
  await redis.zrem("rettungskraefte", name);
  res.status(200).send({ message: "Erfolgreich gelöscht!" });
});