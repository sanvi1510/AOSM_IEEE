# Quiz Generator Application
## Description
The Quiz Generator Application is a web-based tool that allows users to create quizzes from PDF files. The application uses natural language processing (NLP) and machine learning (ML) to extract topics and generate multiple-choice questions.

## Key Features
* Upload PDF files and extract topics
* Select topics to focus on
* Generate multiple-choice questions based on the selected topics
* Configure quiz settings, such as difficulty level and number of questions
* Take the quiz and view results
* Review questions and answers
* Download quiz results as CSV or PDF

## Architecture / Workflow
The application is built using Flask, a Python web framework, and utilizes several libraries, including PyMuPDF, pytesseract, and langchain. The workflow is as follows:
1. User uploads a PDF file
2. The application extracts topics from the PDF file using NLP
3. The user selects topics to focus on
4. The application generates multiple-choice questions based on the selected topics using ML
5. The user configures quiz settings and takes the quiz
6. The application displays quiz results and allows the user to review questions and answers

## Installation
To install the application, follow these steps:
1. Clone the repository
2. Install the required libraries by running `pip install -r requirements.txt`
3. Set the `SECRET_KEY` and `GROQ_API_KEY` environment variables
4. Run the application using `flask run`

## Configuration
The application can be configured by modifying the `app.py` file. The following settings can be changed:
* `SECRET_KEY`: a secret key used for encryption
* `GROQ_API_KEY`: an API key for the langchain library
* `SQLALCHEMY_DATABASE_URI`: the URI of the database

## Usage
To use the application, follow these steps:
1. Upload a PDF file
2. Select topics to focus on
3. Configure quiz settings
4. Take the quiz
5. View quiz results and review questions and answers

## API Reference
The application does not have a public API.

## Examples
Here is an example of how to use the application:
```python
def extract_text_from_pdf(pdf_file_storage):
    pdf_bytes = pdf_file_storage.read()
    text = ""
    try:
        with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
            text = "".join(page.get_text() for page in doc)
        if len(text.strip()) < 100 and TESSERACT_AVAILABLE:
            print("Direct text extraction yielded little content. Attempting OCR...")
            ocr_text = perform_ocr_on_pdf(pdf_bytes)
            text += "\n" + ocr_text
    except Exception as e:
        print(f"Error processing PDF with PyMuPDF: {e}")
        if TESSERACT_AVAILABLE:
            print("PyMuPDF failed. Falling back to OCR.")
            text = perform_ocr_on_pdf(pdf_bytes)
        else:
            print("OCR is not available. Could not extract text.")
            return ""
    return text

def perform_ocr_on_pdf(pdf_bytes):
    if not TESSERACT_AVAILABLE:
        return ""
    try:
        images = convert_from_bytes(pdf_bytes, dpi=300)
        full_text = ""
        for img in images:
            full_text += pytesseract.image_to_string(img) + "\n"
        return full_text
    except Exception as e:
        print(f"An error occurred during OCR: {e}")
        return ""
```

## Testing
To test the application, follow these steps:
1. Run the application using `flask run`
2. Upload a PDF file
3. Select topics to focus on
4. Configure quiz settings
5. Take the quiz
6. View quiz results and review questions and answers

## License
MIT License

Copyright (c) 2023 Quiz Generator Application

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.