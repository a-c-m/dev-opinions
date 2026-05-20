import { useState } from "react";
import { env } from "./env.js";

type Props = { greeting?: string };

export function App({ greeting = "hello" }: Props) {
  const [count, setCount] = useState(0);
  return (
    <main>
      <h1>{greeting}, base-app</h1>
      <p>api: {env.API_URL}</p>
      <button onClick={() => setCount((c) => c + 1)} type="button">
        clicked {count} times
      </button>
    </main>
  );
}
