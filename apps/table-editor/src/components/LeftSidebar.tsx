import PdfLoader from "./PdfLoader";

export default function LeftSidebar() {
  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        width: 320,
        background: "#181818",
        borderRight: "1px solid #333",
        padding: 12,
        overflowY: "auto",
        zIndex: 1000,
      }}
    >
      <h3 style={{ marginTop: 0 }}>PDF</h3>

      <PdfLoader />
    </div>
  );
}