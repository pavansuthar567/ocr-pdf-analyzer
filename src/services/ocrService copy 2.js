const fs = require("fs");
const path = require("path");
const pdfPoppler = require("pdf-poppler");
const Tesseract = require("tesseract.js");

class OCRService {
  constructor() {
    this.uploadDir = path.join(__dirname, "../../uploads");
    // this.tempDir = path.join(__dirname, "../../temp");
    this.outputDir = path.join(__dirname, "../../images");

    [this.uploadDir, this.outputDir].forEach((dir) => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });

    this.validatePopplerInstallation();
  }

  validatePopplerInstallation() {
    const popplerPath = process.env.POPPLER_PATH?.trim();
    const pdftoppmPath = path.join(popplerPath, "pdftoppm.exe");

    if (!fs.existsSync(pdftoppmPath)) {
      throw new Error("Poppler not found. Set correct path in .env.");
    }
  }

  async extractTextFromImage(imagePath) {
    const {
      data: { text },
    } = await Tesseract.recognize(imagePath, "eng");
    return text;
  }

  parseKeyValue(text) {
    return {
      buyerName: text.match(/Buyer.*?:\s*(.*?)(?=\n|$)/i)?.[1] || "Not Found",
      sellerName: text.match(/Seller.*?:\s*(.*?)(?=\n|$)/i)?.[1] || "Not Found",
      propertyAddress:
        text.match(/Property.*?:\s*(.*?)(?=\n|$)/i)?.[1] || "Not Found",
      offerPrice: text.match(/\$\s*([\d,]+)/i)?.[1]
        ? `$${text.match(/\$\s*([\d,]+)/i)[1]}`
        : "Not Found",
      keyDates: text.match(/Key Date.*?:\s*(.*?)(?=\n|$)/i)?.[1] || "Not Found",
    };
  }

  async processDocument(pdfPath) {
    try {
      const images = await this.convertPDF(pdfPath);
      let extractedText = "";

      for (const image of images) {
        extractedText += (await this.extractTextFromImage(image)) + "\n";
      }

      return this.parseKeyValue(extractedText);
    } catch (error) {
      throw new Error("Failed to process document.");
    }
  }

  async convertPDF(pdfPath) {
    const opts = {
      format: "png",
      out_dir: this.outputDir,
      out_prefix: path.basename(pdfPath, path.extname(pdfPath)),
      density: 1200,
      scale: 1200,
    };

    try {
      await pdfPoppler.convert(pdfPath, opts);
      return fs
        .readdirSync(this.outputDir)
        .map((f) => path.join(this.outputDir, f));
    } catch (err) {
      throw new Error(`Error converting PDF: ${err.message}`);
    }
  }
}

module.exports = new OCRService();
