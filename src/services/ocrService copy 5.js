const fs = require("fs");
const path = require("path");
const pdfPoppler = require("pdf-poppler");
const Tesseract = require("tesseract.js");
const sharp = require("sharp");
const winkNLP = require("wink-nlp");
const model = require("wink-eng-lite-web-model");
const nlp = winkNLP(model);

class OCRService {
  constructor() {
    this.uploadDir = path.join(__dirname, "../../uploads");
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

  async preprocessImage(imagePath) {
    const processedPath = imagePath.replace(".png", "-processed.png");
    await sharp(imagePath)
      .grayscale() // Convert to grayscale
      .normalize() // Improve contrast
      .toFile(processedPath);
    return processedPath;
  }

  async extractTextFromImage(imagePath) {
    const processedImage = await this.preprocessImage(imagePath);
    const {
      data: { text },
    } = await Tesseract.recognize(processedImage, "eng");
    return text;
  }

  async extractAllText(imagePaths) {
    let fullText = "";
    for (const imagePath of imagePaths) {
      fullText += (await this.extractTextFromImage(imagePath)) + "\n";
    }
    return fullText;
  }

  parseKeyValue(text) {
    // Normalize whitespace
    const normText = text.replace(/\s+/g, " ");
    // Create an NLP doc (for potential future use)
    const doc = nlp.readDoc(normText);

    // Extract buyerName from the very first line before "to seller:"
    let buyerName = "Not Found";
    const buyerLineMatch = normText.match(/^([^ ]+)\s+to seller:/i);
    if (buyerLineMatch) {
      buyerName = buyerLineMatch[1].trim();
    }

    // Extract sellerName from a pattern like "SELLER - The Seller(s) ia/are_<name>"
    let sellerName = "Not Found";
    const sellerMatch = normText.match(
      /SELLER\s*-\s*The Seller\(s\)\s*ia\/are_([^\s]+)\s+/i
    );
    if (sellerMatch) {
      sellerName = sellerMatch[1].trim();
    }

    // Extract propertyAddress from "is known as ..." pattern
    let propertyAddress = "Not Found";
    const propertyMatch = normText.match(
      /is known as\s*([^,]+,\s*[^,]+,\s*[^,]+,\s*\d+)/i
    );
    if (propertyMatch) {
      propertyAddress = propertyMatch[1].trim();
    }

    // Extract offerPrice as first dollar value encountered
    let offerPrice = "Not Found";
    const priceMatch = normText.match(/\$\s*([\d,]+)/);
    if (priceMatch) {
      offerPrice = `$${priceMatch[1].trim()}`;
    }

    // Extract keyDates by finding a date pattern (e.g. 05/21/2023)
    let keyDates = "Not Found";
    const dateMatch = normText.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
    if (dateMatch) {
      keyDates = dateMatch[1].trim();
    }

    return { buyerName, sellerName, propertyAddress, offerPrice, keyDates };
  }

  async processDocument(pdfPath) {
    try {
      const images = await this.convertPDF(pdfPath);
      const extractedText = await this.extractAllText(images);
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
