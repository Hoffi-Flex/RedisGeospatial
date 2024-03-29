const { parentPort } = require("worker_threads");
const { faker } = require("@faker-js/faker");
const { Redis } = require("ioredis");
let redis;
if (process.env.REDIS_CLUSTER === "true") {
  redis = new Redis.Cluster(
    [
      {
        port: process.env.REDIS_CLUSTER_PORT_1,
        host: process.env.REDIS_CLUSTER_HOST_1,
      },
      {
        port: process.env.REDIS_CLUSTER_PORT_2,
        host: process.env.REDIS_CLUSTER_HOST_2,
      },
      {
        port: process.env.REDIS_CLUSTER_PORT_3,
        host: process.env.REDIS_CLUSTER_HOST_3,
      },
    ],
    {
      scaleReads: "slave",
    }
  );
} else {
  redis = new Redis(process.env.REDIS_PORT, process.env.REDIS_HOST);
}
//parentPort.postMessage(process.env.RESCUE_COUNT);
let rescues = [];
let perfIndex = [];

async function initialRescueService() {
  parentPort.postMessage(
    `Started initial generation of ${process.env.RESCUE_COUNT} rescue services.`
  );
  await redis.del("rescueservice");
  for (let i = 0; i < process.env.RESCUE_COUNT; i++) {
    const name = `Rescue Service ${i}`;
    rescues.push(name);
    const lat = faker.address.latitude(54.9079, 47.40724, 4);
    const long = faker.address.longitude(14.98853, 5.98815, 4);
    await redis.geoadd("rescueservice", long, lat, name);
  }
  parentPort.postMessage(
    `All initial ${process.env.RESCUE_COUNT} rescue services were successfully added.`
  );
}

function generateRandomNumber(id, count, range) {
  const lowerBound = (id * range) / count;
  const upperBound = id === count - 1 ? range : ((id + 1) * range) / count;

  const randomNumber = Math.random() * (upperBound - lowerBound) + lowerBound;

  return randomNumber;
}

async function startSimulator(id, count, range) {
  let active = true;
  if (process.env.DEBUG === "true") {
    parentPort.postMessage(
      `Position simulatior #${id + 1}/${count} started. In Range ${range}`
    );
  }
  let floatingMean = 0;
  let t0 = Date.now();
  let alpha = 0.99;
  const speed = 50 / 60 / 60 / 1000; //KM/h to KM/ms

  const speedCalc = process.env.REALISTIC_MOVEMENTS === "true" ? true : false;
  let moveRange = 0.5;

  // Part of the performance monitoring
  let redisActions = 0;
  let interval = 1000;
  if (process.env.DEBUG === "true") {
    setInterval(() => {
      perfIndex.push(redisActions / (interval / 1000));
      redisActions = 0;
    }, interval);
  }

  while (active) {
    if (speedCalc) {
      const t1 = Date.now();
      const dt = t1 - t0;
      // if(dt * range/count < 500) continue;
      t0 = t1;
      floatingMean = alpha * floatingMean + (1 - alpha) * dt;

      const estimatedSleepTime = (range / count) * floatingMean;
      moveRange = Math.max(speed * estimatedSleepTime, 0.5e-2);
    }

    const randomIndex = Math.floor(generateRandomNumber(id, count, range));
    const randomRescue = rescues[randomIndex];
    const position = await redis.geopos("rescueservice", randomRescue);
    redisActions++;
    if (position[0] === null) continue;
    const newPos = faker.address.nearbyGPSCoordinate(
      [Number(position[0][1]), Number(position[0][0])],
      moveRange,
      true
    );
    await redis.geoadd("rescueservice", newPos[1], newPos[0], randomRescue);
    redisActions++;
  }
}

async function main() {
  await initialRescueService();
  for (let i = 0; i < process.env.SIMULATON_INSTANCES; i++)
    startSimulator(i, process.env.SIMULATON_INSTANCES, process.env.RESCUE_COUNT);
  parentPort.postMessage("All simulators started.");
  //Performance Monitoring for Debugging
  let timeSeries = [];
  if (process.env.DEBUG === "true") {
    setInterval(() => {
      const mean = perfIndex.reduce((a, b) => a + b, 0) / perfIndex.length;
      timeSeries.push(mean);
      parentPort.postMessage(
        `Mean Redis Actions per second: ${Math.floor(
          mean * process.env.SIMULATON_INSTANCES
        )}`
      );
      perfIndex = [];
    }, 1000);
    setInterval(() => {
      const mean = timeSeries.reduce((a, b) => a + b, 0) / timeSeries.length;
      parentPort.postMessage(
        `Mean Redis Actions per Minute: ${Math.floor(
          mean * process.env.SIMULATON_INSTANCES
        )}`
      );
      timeSeries = [];
    }, 60000);
  }
}

main();
