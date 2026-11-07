import Link from "next/link";
export const metadata = { title: "Offline" };
export default function Offline() {
  return (
    <div className="page">
      <h1>You&apos;re offline</h1>
      <p className="lede">This page isn&apos;t saved on your device yet. These still work offline once you&apos;ve opened them while online:</p>
      <ul className="stack" style={{ paddingLeft: 20 }}>
        <li><Link className="link" href="/scan">Scan a label on this device</Link> (after the OCR engine has been downloaded once)</li>
        <li><Link className="link" href="/search">Products in the FoodDecode catalogue</Link></li>
        <li><Link className="link" href="/learn">Teach Me lessons</Link></li>
      </ul>
      <p className="small muted">Your health profile and history are kept on the server and load again when you&apos;re back online.</p>
    </div>
  );
}
