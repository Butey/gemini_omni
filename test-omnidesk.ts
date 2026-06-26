import fetch from "node-fetch";

async function run() {
  const res = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ticketContext: {
        id: "234-323967",
        description: "Context fetched from active Omnidesk ticket..."
      },
      history: [],
      userQuery: "о чем тикет?"
    })
  });
  console.log(res.status);
  console.log(await res.text());
}
run();
