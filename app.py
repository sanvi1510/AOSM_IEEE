import os
import re
import fitz  # PyMuPDF
from flask import Flask, request, jsonify
from flask_cors import CORS
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser

# --- 1. CONFIGURATION ---
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    print("FATAL: GROQ_API_KEY environment variable not set. Please configure it.")
    exit()

# Initialize Flask App
app = Flask(__name__)
CORS(app)

# --- 2. LLM AND PROMPT SETUP ---
llm = ChatGroq(
    api_key=GROQ_API_KEY,
    model="llama3-70b-8192",
    temperature=0.2
)

mcq_prompt = PromptTemplate(
    input_variables=["context", "num_questions", "difficulty"],
    template="""You are a strict, instruction-following AI that generates perfectly formatted multiple-choice questions with explanations.

Based on the following text, generate exactly {num_questions} multiple-choice questions of {difficulty} difficulty.

---TEXT BEGINS---
{context}
---TEXT ENDS---

You MUST follow this format for EACH question. Do not deviate. Add a brief, one-sentence explanation for why the answer is correct.

**---START OF EXAMPLE---**
Question: What is the capital of France?
A) London
B) Berlin
C) Paris
D) Madrid
Correct Answer: C
Explanation: Paris is the official capital city of France, located in the north-central part of the country.
**---END OF EXAMPLE---**

Now, generate the questions.
"""
)

mcq_chain = mcq_prompt | llm | StrOutputParser()

# --- 3. HELPER FUNCTIONS ---
def parse_mcq_text(mcq_text):
    """
    Final parser with a non-greedy regex that correctly handles the end of the explanation.
    """
    questions = []
    
    # =================== THIS REGEX IS THE ONLY PART THAT CHANGED ===================
    pattern = re.compile(
        # Match the question line
        r"Question\s*\d*\s*:{0,1}\s*(?P<question>.+?)\s*"
        # Match all four options
        r"A\)\s*(?P<optA>.+?)\s*"
        r"B\)\s*(?P<optB>.+?)\s*"
        r"C\)\s*(?P<optC>.+?)\s*"
        r"D\)\s*(?P<optD>.+?)\s*"
        # Match the correct answer line
        r"Correct Answer:\s*(?P<answer_letter>[A-D])\s*"
        # Match the explanation, but make it non-greedy (.+?) and stop before the next "Question:" or the end of the string
        r"Explanation:\s*(?P<explanation>.+?)(?=\n\s*Question|\Z)",
        re.DOTALL | re.IGNORECASE
    )
    # ===============================================================================

    cleaned_text = re.sub(r'\*\*', '', mcq_text)
    matches = pattern.finditer(cleaned_text)

    for match in matches:
        try:
            data = match.groupdict()
            options = [
                data['optA'].strip(), 
                data['optB'].strip(), 
                data['optC'].strip(), 
                data['optD'].strip()
            ]
            
            answer_letter = data['answer_letter'].strip().upper()
            answer_index = ord(answer_letter) - ord('A')
            answer_text = options[answer_index]

            questions.append({
                "question": data['question'].strip(),
                "options": options,
                "answer": answer_text,
                "explanation": data['explanation'].strip()
            })
        except (KeyError, IndexError) as e:
            print(f"Skipping a malformed block identified by regex. Error: {e}")
            continue
            
    print(f"Successfully parsed {len(questions)} questions with explanations.")
    return questions


# --- 4. MAIN API ENDPOINT ---
@app.route('/generate-quiz', methods=['POST'])
def generate_quiz():
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file:
        try:
            doc = fitz.open(stream=file.read(), filetype="pdf")
            text = "".join(page.get_text() for page in doc)
            doc.close()

            if not text.strip():
                return jsonify({"error": "Could not extract text from PDF."}), 400

            num_questions = int(request.form.get('num_questions', 5))
            difficulty = request.form.get('difficulty', 'Medium')
            
            print(f"Generating {num_questions} {difficulty} questions from text...")
            shortened_text = text[:12000]

            llm_output = mcq_chain.invoke({
                "context": shortened_text,
                "num_questions": num_questions,
                "difficulty": difficulty
            })
            
            questions = parse_mcq_text(llm_output)
            
            if not questions:
                print("----------- RAW AI OUTPUT (PARSING FAILED) -----------")
                print(llm_output)
                print("-----------------------------------------------------")
                return jsonify({"error": "The AI model failed to generate questions in the correct format."}), 500

            return jsonify({"questions": questions})

        except Exception as e:
            print(f"An error occurred: {e}")
            return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500

    return jsonify({"error": "Invalid file type"}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)