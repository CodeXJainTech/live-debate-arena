# Debate Platform

A live debate platform where two people argue a topic while an audience votes in real time. AI scores each argument on logic, evidence, and persuasion separately. A full verdict is generated at the end.

Built with Next.js, Socket.io, Redis, PostgreSQL, and Gemini.


## How it works

Two debaters get private links. An audience joins a public link. The host starts the debate, arguments go back and forth by round, the audience votes live, and when all rounds are done the AI generates a verdict based on the full transcript.


## System overview

```mermaid
graph TD
  A[Browser - Debater A] -->|Socket.io| S[Node.js Server]
  B[Browser - Debater B] -->|Socket.io| S
  C[Browser - Audience] -->|Socket.io| S
  S -->|room state, votes, scores| A
  S -->|room state, votes, scores| B
  S -->|room state, votes, scores| C
  S --> R[Upstash Redis]
  S --> P[Neon PostgreSQL]
  S --> G[Gemini API]
  R -->|vote counts, room state| S
  P -->|arguments, scores, verdict| S
```


## Debate state machine

```mermaid
stateDiagram-v2
  [*] --> WAITING
  WAITING --> TOPIC_REVEAL : both debaters connected, A clicks start
  TOPIC_REVEAL --> ROUND : 10 second timer ends
  ROUND --> ROUND : argument submitted, turns remaining
  ROUND --> VOTING : all rounds complete
  VOTING --> VERDICT : 30 second timer ends
  VERDICT --> FINISHED : AI verdict saved
  FINISHED --> [*]
```


## Vote aggregation

```mermaid
sequenceDiagram
  participant Audience
  participant Server
  participant Redis

  Audience->>Server: vote:cast { value: FOR }
  Server->>Redis: DECR previous vote if exists
  Server->>Redis: INCR new vote key
  Server->>Redis: SET user vote key
  Server->>Audience: vote:confirmed

  loop every 200ms
    Server->>Redis: GET votes:for, votes:against
    Server->>Audience: vote:update { for, against, total }
  end
```


## AI scoring pipeline

```mermaid
sequenceDiagram
  participant Debater
  participant Server
  participant Gemini
  participant DB

  Debater->>Server: debate:submit_argument
  Server->>DB: create Argument record
  Server->>Debater: debate:argument_submitted (all clients)
  Server->>Server: advanceTurn (non-blocking)

  par logic prompt
    Server->>Gemini: scoreLogic()
    Gemini-->>Server: { score, critique }
    Server->>DB: create Score record
  and evidence prompt
    Server->>Gemini: scoreEvidence()
    Gemini-->>Server: { score, critique }
    Server->>DB: create Score record
  and persuasion prompt
    Server->>Gemini: scorePersuasion()
    Gemini-->>Server: { score, critique }
    Server->>DB: create Score record
  end

  Server->>Debater: scoring:dimension (each as it arrives)
  Server->>Debater: scoring:complete
```


## Getting started

Clone the repo and install dependencies.

```bash
npm install
```

Copy the example env file and fill in your values.

```bash
cp .env.local.example .env.local
```

You need accounts on Neon, Upstash, and Google AI Studio. All are free.

Push the database schema.

```bash
npx prisma generate
npx prisma db push
```

Start the dev server.

```bash
npm run dev
```

Open http://localhost:3000, create a room, and share the links.


## Environment variables

```
NEXT_PUBLIC_APP_URL      URL of the app, http://localhost:3000 in dev
DATABASE_URL             Neon PostgreSQL connection string
UPSTASH_REDIS_REST_URL   Upstash Redis REST URL
UPSTASH_REDIS_REST_TOKEN Upstash Redis REST token
GEMINI_API_KEY           Google AI Studio API key
DEBATER_JWT_SECRET       Any random 32 character string
```

## Tech stack

Next.js with App Router handles pages and API routes. A custom server.ts attaches Socket.io to the same HTTP instance so everything runs on one port.

Upstash Redis stores live room state and vote counters using atomic INCR and DECR operations to handle concurrent votes safely.

Neon PostgreSQL stores the permanent record of every debate including arguments, scores, and the final verdict. Prisma handles all queries.

Gemini 2.0 Flash scores each argument with three separate focused prompts and generates the final verdict from the full transcript.