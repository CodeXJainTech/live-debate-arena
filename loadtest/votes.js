const { io } = require("socket.io-client");

const ROOM_ID = process.argv[2];
const NUM_VOTERS = parseInt(process.argv[3] || "50");
const STAGGER_MS = parseInt(process.argv[4] || "0");
const VOTE_VALUE = process.argv[5] || "alternate"; // "alternate" | "FOR" | "AGAINST"
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

if (!ROOM_ID) {
  console.error("Usage: node votes.js <ROOM_ID> [numVoters] [staggerMs] [FOR|AGAINST|alternate]");
  process.exit(1);
}

let connected = 0;
let stateReceived = 0;
let confirmed = 0;
let forVotes = 0;
let againstVotes = 0;
let errored = 0;
const sockets = [];
const startTime = Date.now();

function elapsed() {
  return ((Date.now() - startTime) / 1000).toFixed(1) + "s";
}

function printHeader() {
  console.log("");
  console.log("==================================================");
  console.log("  LIVE DEBATE ARENA - VOTE LOAD TEST");
  console.log("==================================================");
  console.log(`  Room ID     : ${ROOM_ID}`);
  console.log(`  Voters      : ${NUM_VOTERS}`);
  console.log(`  Stagger     : ${STAGGER_MS}ms between connections`);
  console.log(`  Vote mode   : ${VOTE_VALUE}`);
  console.log(`  Target      : ${BASE_URL}`);
  console.log("==================================================");
  console.log("");
}

function printProgress() {
  const bar = (value, total, width = 30) => {
    const filled = Math.round((value / total) * width);
    return "#".repeat(filled) + "-".repeat(width - filled);
  };

  process.stdout.write(
    `\r[${elapsed().padStart(6)}]  ` +
    `connected ${String(connected).padStart(3)}/${NUM_VOTERS}  ` +
    `[${bar(connected, NUM_VOTERS)}]  ` +
    `confirmed ${String(confirmed).padStart(3)}/${NUM_VOTERS}  ` +
    `errors ${errored}`
  );
}

function spawnVoter(i) {
  const sessionId = `loadtest-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`;
  const value =
    VOTE_VALUE === "alternate" ? (i % 2 === 0 ? "FOR" : "AGAINST") : VOTE_VALUE;

  const socket = io(BASE_URL, {
    auth: {
      roomId: ROOM_ID,
      displayName: `Voter${i}`,
      age: 25,
      sessionId,
    },
    transports: ["websocket"],
  });

  socket.on("connect", () => {
    connected++;
    printProgress();
  });

  socket.on("room:state", (state) => {
    stateReceived++;
    if (state.state !== "ROUND" && state.state !== "VOTING") {
      console.log("");
      console.log(
        `  [warn] Voter ${i}: room is in state "${state.state}" - ` +
        `votes are only accepted during ROUND or VOTING.`
      );
    }
    socket.emit("vote:cast", { value });
  });

  socket.on("vote:confirmed", (data) => {
    confirmed++;
    if (data.value === "FOR") forVotes++;
    else againstVotes++;
    printProgress();
  });

  socket.on("error", (data) => {
    errored++;
    console.log("");
    console.log(`  [error] Voter ${i}: ${data.message}`);
    printProgress();
  });

  socket.on("connect_error", (err) => {
    errored++;
    console.log("");
    console.log(`  [error] Voter ${i} connection failed: ${err.message}`);
    printProgress();
  });

  sockets.push(socket);
}

printHeader();
console.log("Connecting voters...");
console.log("");

for (let i = 0; i < NUM_VOTERS; i++) {
  if (STAGGER_MS > 0) {
    setTimeout(() => spawnVoter(i), i * STAGGER_MS);
  } else {
    spawnVoter(i);
  }
}

const totalSpawnTime = NUM_VOTERS * STAGGER_MS;

setTimeout(() => {
  console.log("");
  console.log("");
  console.log("==================================================");
  console.log("  RESULTS");
  console.log("==================================================");
  console.log(`  Connected          : ${connected}/${NUM_VOTERS}`);
  console.log(`  room:state received: ${stateReceived}/${NUM_VOTERS}`);
  console.log(`  Votes confirmed    : ${confirmed}/${NUM_VOTERS}`);
  console.log(`    FOR              : ${forVotes}`);
  console.log(`    AGAINST          : ${againstVotes}`);
  console.log(`  Errors             : ${errored}`);
  console.log(`  Total time         : ${elapsed()}`);
  console.log("==================================================");

  if (confirmed === NUM_VOTERS) {
    console.log("  PASS - all votes confirmed");
  } else {
    console.log(`  ${NUM_VOTERS - confirmed} vote(s) did not confirm - check warnings above`);
  }
  console.log("");
  console.log("Check the audience tab - the opinion meter should");
  console.log("reflect these votes within 1-2 pulse cycles (~400ms).");
  console.log("");

  sockets.forEach((s) => s.disconnect());
  process.exit(0);
}, totalSpawnTime + 8000);
