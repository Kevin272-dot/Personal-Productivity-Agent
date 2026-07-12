let databaseClient = null;

function getPrismaClient() {
  if (databaseClient) {
    return databaseClient;
  }

  const postgres = require("postgres");

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set.");
  }

  databaseClient = postgres(process.env.DATABASE_URL, {
    ssl: "require",
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return databaseClient;
}

async function closePrismaClient() {
  if (!databaseClient) {
    return;
  }

  await databaseClient.end();
  databaseClient = null;
}

module.exports = {
  getPrismaClient,
  closePrismaClient,
};
