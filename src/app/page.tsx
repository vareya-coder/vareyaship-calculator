import Image from "next/image";

import { Country } from '@/app/Country'



export default function Home() {
  return (
    <main>
      <div>
        <h2>Price Calculator</h2>
      </div>
      <Country />

    </main>
  );
}
