import sys, re, json
from pdf2image import convert_from_path
import pytesseract
from PIL import Image, ImageEnhance
from word2number import w2n

# Set Tesseract command (ensure this path is correct)
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# Disable pixel limit for high-DPI images
Image.MAX_IMAGE_PIXELS = None

def process_pdf(pdf_path):
    # Convert PDF pages to images (dpi=300 for a balance of quality and performance)
    images = convert_from_path(pdf_path, dpi=300)
    full_text = ""
    for image in images:
        # Enhance image quality by increasing contrast
        enhancer = ImageEnhance.Contrast(image)
        enhanced_image = enhancer.enhance(2.0)
        text = pytesseract.image_to_string(enhanced_image)
        full_text += text + " "
    return full_text

def parse_text(text):
    # Normalize whitespace
    norm_text = " ".join(text.split())

    seller = "Not Found"

        # Extract buyer and seller names from text below "Seller Name Buyer Name"
    buyer_seller_match = re.search(r"Seller Name\s+Buyer Name\s+(.*?)\s+SELLER\(S\)\s+BUYER\(S\)", norm_text, re.IGNORECASE)
    if buyer_seller_match:
        buyer_seller_text = buyer_seller_match.group(1).strip()
        addresses = re.split(r'\d{5}', buyer_seller_text)
        if len(addresses) >= 2:
            seller = addresses[0].strip()
            buyer = addresses[1].strip()
        else:
            buyer = "Not Found"
    else:
        buyer = "Not Found"
    
    if buyer == "Not Found":
        # Extract buyer name: capture first word before "to seller"
        buyer_match = re.search(r"^(\w+)\s+to seller", norm_text, re.IGNORECASE)
        buyer = buyer_match.group(1).strip() if buyer_match else "Not Found"
    
    #  # Extract seller name: look for "The Seller(s) is/are" followed by text and "residing at"
    if seller == "Not Found":
        seller_match = re.search(r"The Seller\(s\) ia/are\s+(.*?)\s+residing at", norm_text, re.IGNORECASE)
        seller = seller_match.group(1).strip() if seller_match else "Not Found"
    
    # Extract seller name: look for "Seller Name" followed by the next line
    # seller_match = re.search(r"Seller Name\s*:\s*(.*?)\s*\n", norm_text, re.IGNORECASE)

    # if seller_match:
    #     seller = seller_match.group(1).strip()
    # else:
    #     # If not found, look for "The Seller(s) is/are" followed by text and "residing at"
    #     seller_match = re.search(r"The Seller\(s\) is/are\s+(.*?)\s+residing at", norm_text, re.IGNORECASE)
    #     seller = seller_match.group(1).strip() if seller_match else "Not Found"
    
    #     # Extract property address: capture text between "is known as" and "located"
    # property_match = re.search(r"is known as_\s*(.*?)\s+located", norm_text, re.IGNORECASE)

    # Extract property address: capture text between "is known as" and "located" or between "Property known as" and "(City)"
    property_match = re.search(r"(?:is known as_\s*(.*?)\s+located|Property known as\s*(.*?)\s+\(City\))", norm_text, re.IGNORECASE)
    if property_match:
        property_address = property_match.group(1).strip() if property_match.group(1) else property_match.group(2).strip()
    else:
        property_address = "Not Found"
    
    # Extract offer price: first dollar value encountered or text between "The purchase price is" and "."
    price_text_match = re.search(r"The purchase price is\s+(.*?)\s+ONLY\.", norm_text, re.IGNORECASE)
    if price_text_match:
        try:
            # Correctly handle the word "and" in the price text
            price_text = price_text_match.group(1).replace(" and ", " ")
            price_number = w2n.word_to_num(price_text)
            price = f"${price_number}"
        except ValueError:
            price = "Not Found"
    else:
        price_match = re.search(r"\$\s*([\d,]+)", norm_text)
        if price_match:
            price = "$" + price_match.group(1).strip()
        else:
            price = "Not Found"
    
    # Extract key date: first occurrence of a date (e.g., 05/21/2023)
    date_match = re.search(r"(\d{1,2}/\d{1,2}/\d{2,4})", norm_text)
    key_date = date_match.group(1).strip() if date_match else "Not Found"
    
    return {
        "buyerName": buyer,
        "sellerName": seller,
        "propertyAddress": property_address,
        "offerPrice": price,
        "keyDates": key_date
    }

if __name__ == "__main__":
    pdf_path = sys.argv[1]
    full_text = process_pdf(pdf_path)
    result = parse_text(full_text)
    print(json.dumps(result))
