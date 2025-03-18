# Node.js and Python OCR Application

This application is a modern Node.js template with Express, integrated with a Python-based OCR service to process PDF documents.

## Prerequisites

- **Node.js** (v14 or higher)
- **npm** (v6 or higher)
- **Python** (v3.6 or higher)
- **pip** (Python package manager)

## Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <repository-directory>
```

### 2. Node.js Setup

1. **Install Node.js dependencies:**

   ```bash
   npm install
   ```

2. **Copy the environment variables template:**

   ```bash
   cp .env.example .env
   ```

3. **Update the `.env` file** with your configuration.

### 3. Python Setup

1. **Create a virtual environment:**

   ```bash
   python -m venv venv
   ```

2. **Activate the virtual environment:**

   - On Windows:
     ```bash
     .\venv\Scripts\activate
     ```
   - On macOS/Linux:
     ```bash
     source venv/bin/activate
     ```

3. **Install Python dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

   Ensure `requirements.txt` includes:
   ```
   pdf2image
   pytesseract
   pillow
   word2number
   ```

4. **Set up Tesseract:**

   - Ensure Tesseract is installed on your system.
   - Update the path in `src/services/ocr_processor.py`:
     ```python
     pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
     ```

### 4. Running the Application

1. **Start the Node.js server:**

   ```bash
   npm start
   ```

   Or for development with hot-reload:

   ```bash
   npm run dev
   ```

2. **Access the API:**

   - Visit `http://localhost:<port>` to see the welcome message.
   - Use the `/ocr` endpoint to upload and process PDF files.

### 5. Testing

- **Run tests:**

  ```bash
  npm test
  ```

## Project Structure

```
├── src/              # Source code
├── tests/            # Test files
├── .env.example      # Environment variables template
├── .gitignore        # Git ignore rules
├── package.json      # Project configuration
└── README.md         # Project documentation
``` 