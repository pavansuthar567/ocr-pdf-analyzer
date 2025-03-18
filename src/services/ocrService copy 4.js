const fs = require("fs");
const path = require("path");
const pdfPoppler = require("pdf-poppler");
const Tesseract = require("tesseract.js");
const sharp = require("sharp");

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
    await sharp(imagePath).grayscale().normalize().toFile(processedPath);
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
    const buyerMatch = text.match(/(?:Buyer|Purchaser).*?:\s*(.*?)(?=\n|$)/i);
    const sellerMatch = text.match(/(?:Seller|Vendor).*?:\s*(.*?)(?=\n|$)/i);
    const propertyMatch = text.match(
      /(?:Property to be Sold|Address).*?:\s*(.*?)(?=\n|$)/i
    );
    const priceMatch = text.match(/(?:Buy|Offer Price)\s*\$?([\d,]+)/i);
    const dateMatch = text.match(
      /(?:Key Dates?|Contract Date).*?:\s*(.*?)(?=\n|$)/i
    );

    return {
      buyerName: buyerMatch ? buyerMatch[1].trim() : "Not Found",
      sellerName: sellerMatch ? sellerMatch[1].trim() : "Not Found",
      propertyAddress: propertyMatch ? propertyMatch[1].trim() : "Not Found",
      offerPrice: priceMatch ? `$${priceMatch[1]}` : "Not Found",
      keyDates: dateMatch ? dateMatch[1].trim() : "Not Found",
    };
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
