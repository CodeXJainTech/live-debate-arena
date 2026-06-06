import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";

export function useVotes(socket: Socket | null){
  const [forCount, setForCount] = useState(0);
  const [againstCount, setAgainstCount] = useState(0);
  const [myVote, setMyVote] = useState<"FOR" | "AGAINST" | null>(null);

  const total = forCount + againstCount;
  const percentage = forCount / total *100;

  useEffect(() => {
    if(!socket){
      return;
    }

    socket.on("vote:update", (data: { for: number; against: number }) => {
      setForCount(data.for);
      setAgainstCount(data.against);
    });

    socket.on("vote:confirmed", (data: { value: "FOR" | "AGAINST" }) => {
      setMyVote(data.value);
    });

    return () => {
      socket.off("vote:update");
      socket.off("vote:confirmed");
    };
  }, [socket]);

  function castVote(value: "FOR" | "AGAINST") {
    if (!socket) return;
    socket.emit("vote:cast", { value });
  }

  return {forCount, againstCount, total, percentage, myVote, castVote};
}