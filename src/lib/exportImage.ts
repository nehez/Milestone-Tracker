/**
 * html2canvas only rasterizes what's laid out, so any scrollable region (the
 * timeline's horizontally-scrolling container) would otherwise export cropped
 * to whatever happened to be scrolled into view. Temporarily expand such
 * regions to their full content width before capturing, then restore them.
 */
function expandScrollables(root: HTMLElement): () => void {
  const candidates = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  const scrollables = candidates.filter((el) => {
    const style = getComputedStyle(el);
    return (
      (style.overflowX === "auto" || style.overflowX === "scroll") &&
      el.scrollWidth > el.clientWidth
    );
  });
  const originals = scrollables.map((el) => ({
    el,
    width: el.style.width,
    overflow: el.style.overflow,
  }));
  scrollables.forEach((el) => {
    el.style.width = `${el.scrollWidth}px`;
    el.style.overflow = "visible";
  });
  return () => {
    originals.forEach(({ el, width, overflow }) => {
      el.style.width = width;
      el.style.overflow = overflow;
    });
  };
}

async function renderToCanvas(node: HTMLElement): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas");
  const restore = expandScrollables(node);
  try {
    // After expanding, the node's true content size may exceed the browser
    // viewport; tell html2canvas to render at that full size instead of
    // clipping to whatever's currently in the window.
    const width = node.scrollWidth;
    const height = node.scrollHeight;
    return await html2canvas(node, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
    });
  } finally {
    restore();
  }
}

export async function exportAsImage(node: HTMLElement, fileName: string, format: "png" | "jpeg") {
  const canvas = await renderToCanvas(node);
  const mime = format === "png" ? "image/png" : "image/jpeg";
  const dataUrl = canvas.toDataURL(mime, 0.95);
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `${fileName}.${format === "jpeg" ? "jpg" : "png"}`;
  link.click();
}

export async function exportAsPdf(node: HTMLElement, fileName: string) {
  const canvas = await renderToCanvas(node);
  const { default: jsPDF } = await import("jspdf");
  const orientation = canvas.width >= canvas.height ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "pt", format: [canvas.width, canvas.height] });
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width, canvas.height);
  pdf.save(`${fileName}.pdf`);
}
