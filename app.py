import os
import re
import uuid
import fitz  # PyMuPDF
import json
import random
from datetime import datetime
from flask import Flask, request, jsonify, render_template, redirect, url_for, flash, abort
from flask_cors import CORS
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain.text_splitter import RecursiveCharacterTextSplitter
from concurrent.futures import ThreadPoolExecutor
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image
import shutil
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_bcrypt import Bcrypt
from youtube_search import YoutubeSearch

# --- App Initialization ---
app = Flask(__name__, template_folder='templates', static_folder='static')
app.config['SECRET_KEY'] = os.getenv("SECRET_KEY", "a-very-secret-key-that-you-should-change")
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'
login_manager.login_message_category = 'info'
CORS(app)

# --- GROQ API Configuration ---
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    print("FATAL: GROQ_API_KEY environment variable not set.")
    exit()

# --- OCR Availability Check ---
def is_tesseract_available():
    return shutil.which("tesseract") is not None

TESSERACT_AVAILABLE = is_tesseract_available()
if not TESSERACT_AVAILABLE:
    print("WARNING: Tesseract is not installed or not in your PATH. OCR functionality will be disabled.")

# === Database Models ===

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(20), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(60), nullable=False)
    quizzes = db.relationship('Quiz', backref='author', lazy=True)

class Quiz(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    questions = db.Column(db.Text, nullable=False)
    date_created = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    is_public = db.Column(db.Boolean, default=False)
    slug = db.Column(db.String(120), unique=True, nullable=True)

class LeaderboardEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quiz.id'), nullable=False)
    participant_name = db.Column(db.String(50), nullable=False)
    score = db.Column(db.Integer, nullable=False)
    total_questions = db.Column(db.Integer, nullable=False)
    time_taken = db.Column(db.Integer, nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# === LangChain & AI Setup ===
llm = ChatGroq(api_key=GROQ_API_KEY, model="llama3-70b-8192", temperature=0.2)

mcq_prompt_template = """
You are an expert in creating educational content. Your task is to generate a series of multiple-choice questions (MCQs) based on the provided text context.
**Instructions:**
1.  Generate up to {num_questions} questions.
2.  The difficulty level for the questions should be '{difficulty}'.
{topic_instruction}
3.  Each question must have exactly 4 options.
4.  Clearly identify the correct answer for each question.
5.  Provide a brief but clear explanation for why the correct answer is right.
6.  Format the output strictly as a valid JSON list of objects. If you cannot generate any questions based on the instructions, return an empty list [].
    Example:
[
  {{
    "question": "Your first question here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answer": "The correct option text",
    "explanation": "Explanation for the first question."
  }}
]
**Context:**
---
{context}
---
"""
mcq_prompt = PromptTemplate(
    input_variables=["context", "num_questions", "difficulty", "topic_instruction"],
    template=mcq_prompt_template
)
mcq_chain = mcq_prompt | llm | StrOutputParser()

topic_prompt_template = """
Based on the following text, identify the top 5 to 10 main topics or key concepts.
The topics should be concise and distinct.
Format the output as a single, comma-separated string.
Example: "Photosynthesis, Cellular Respiration, ATP Production, Calvin Cycle, Glycolysis"

Context:
---
{context}
---
"""
topic_prompt = PromptTemplate(input_variables=["context"], template=topic_prompt_template)
topic_chain = topic_prompt | llm | StrOutputParser()


# === Utility Functions ===
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

def get_video_recommendations(query, max_results=5):
    try:
        results = YoutubeSearch(query, max_results=max_results).to_dict()
        videos = []
        for video in results:
            videos.append({
                "title": video["title"],
                "link": f"https://www.youtube.com{video['url_suffix']}",
                "duration": video["duration"],
                "channel": video["channel"],
                "views": video.get("views", "N/A"),
                "thumbnails": video["thumbnails"][0] if video.get("thumbnails") else None
            })
        return videos
    except Exception as e:
        print(f"Error fetching YouTube results: {e}")
        return []


# === Core Application Routes ===
@app.route('/')
def home():
    return render_template('home.html')

@app.route('/generate')
@login_required
def generate_quiz_page():
    return render_template('index.html')

def process_chunk(chunk_data):
    """Worker function to process a single chunk of text and generate questions."""
    chunk_text, difficulty, questions_per_chunk, topic_instruction = chunk_data
    try:
        raw_response = mcq_chain.invoke({
            "context": chunk_text,
            "num_questions": questions_per_chunk,
            "difficulty": difficulty,
            "topic_instruction": topic_instruction
        })
        start_index = raw_response.find('[')
        end_index = raw_response.rfind(']') + 1
        if start_index == -1 or end_index == 0:
            return []
        json_string = raw_response[start_index:end_index]
        return json.loads(json_string)
    except Exception as e:
        print(f"An unexpected error occurred in process_chunk: {e}")
        print(f"Problematic response was: {raw_response}")
        return []

@app.route('/extract-topics', methods=['POST'])
@login_required
def extract_topics():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file:
        context = extract_text_from_pdf(file)
        if not context.strip():
            return jsonify({"error": "Could not extract text from the PDF."}), 400

        preview_context = " ".join(context.split()[:2000])
        
        try:
            topic_string = topic_chain.invoke({"context": preview_context})
            topics = [topic.strip() for topic in topic_string.replace('"', '').split(',') if topic.strip()]
            return jsonify({"topics": topics})
        except Exception as e:
            print(f"Error extracting topics: {e}")
            return jsonify({"error": "Failed to extract topics from the document."}), 500

    return jsonify({"error": "Invalid request"}), 400


@app.route('/generate-mcq', methods=['POST'])
@login_required
def generate_mcq():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    num_questions_total = request.form.get('num_questions', 5, type=int)
    difficulty = request.form.get('difficulty', 'Medium')
    selected_topics = request.form.get('topics')

    if file:
        context = extract_text_from_pdf(file)
        if not context.strip():
            return jsonify({"error": "Could not extract text from the PDF."}), 400

        if selected_topics:
            topic_instruction = f"**IMPORTANT**: The questions MUST be related to the following topics: {selected_topics}. If the context provided is not relevant to these topics, do not generate any questions."
            recommendation_query = selected_topics.replace(',', ' ')
        else:
            topic_instruction = ""
            recommendation_query = context

        text_splitter = RecursiveCharacterTextSplitter(chunk_size=4000, chunk_overlap=200, length_function=len)
        chunks = text_splitter.split_text(context)
        
        num_chunks = len(chunks)
        questions_per_chunk = max(1, (num_questions_total // num_chunks) + 1)

        all_questions = []
        with ThreadPoolExecutor(max_workers=5) as executor:
            chunk_data_list = [(chunk, difficulty, questions_per_chunk, topic_instruction) for chunk in chunks]
            results = executor.map(process_chunk, chunk_data_list)
            for result in results:
                all_questions.extend(result)
        
        if not all_questions:
            return jsonify({"error": "Failed to generate any questions from the document, or no content matched your selected topics."}), 500
        
        random.shuffle(all_questions)
        final_questions = all_questions[:num_questions_total]
        
        recommendations = get_video_recommendations(recommendation_query)

        try:
            new_quiz = Quiz(
                title=file.filename,
                questions=json.dumps(final_questions),
                author=current_user
            )
            db.session.add(new_quiz)
            db.session.commit()
            
            return jsonify({
                "quiz_id": new_quiz.id,
                "title": new_quiz.title,
                "questions": final_questions,
                "recommendations": recommendations
            })
        except Exception as e:
            db.session.rollback()
            print(f"Error saving quiz: {e}")
            return jsonify({"error": "Failed to save the generated quiz."}), 500

    return jsonify({"error": "Invalid request"}), 400


# === Authentication & Other Routes ===
@app.route("/register", methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('home'))
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')

        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            flash('That username is already taken. Please choose a different one.', 'danger')
            return redirect(url_for('register'))
        
        existing_email = User.query.filter_by(email=email).first()
        if existing_email:
            flash('That email address is already registered. Please log in.', 'danger')
            return redirect(url_for('login'))

        hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
        user = User(username=username, email=email, password=hashed_password)
        db.session.add(user)
        db.session.commit()
        
        flash('Your account has been created! You are now able to log in.', 'success')
        return redirect(url_for('login'))
        
    return render_template('register.html')

@app.route("/login", methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        user = User.query.filter_by(email=email).first()
        if user and bcrypt.check_password_hash(user.password, password):
            login_user(user, remember=True)
            next_page = request.args.get('next')
            return redirect(next_page) if next_page else redirect(url_for('dashboard'))
        else:
            flash('Login Unsuccessful. Please check email and password', 'danger')
    return render_template('login.html')

@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for('home'))

@app.route('/dashboard')
@login_required
def dashboard():
    quizzes = Quiz.query.filter_by(user_id=current_user.id).order_by(Quiz.date_created.desc()).all()
    return render_template('dashboard.html', quizzes=quizzes)

@app.route('/review/<int:quiz_id>')
@login_required
def review_quiz(quiz_id):
    quiz = Quiz.query.get_or_404(quiz_id)
    if quiz.author != current_user:
        abort(403)
    try:
        questions = json.loads(quiz.questions)
    except (json.JSONDecodeError, TypeError):
        questions = []
        print(f"Error decoding questions for quiz ID: {quiz.id}")
    return render_template('review_quiz.html', quiz=quiz, questions=questions)

@app.route('/make-public/<int:quiz_id>', methods=['POST'])
@login_required
def make_quiz_public(quiz_id):
    quiz = Quiz.query.get_or_404(quiz_id)
    if quiz.author != current_user:
        return jsonify({"error": "Unauthorized"}), 403
    if not quiz.is_public:
        quiz.is_public = True
        quiz.slug = str(uuid.uuid4())[:8]
        db.session.commit()
    return jsonify({"public_url": url_for('public_quiz', slug=quiz.slug, _external=True)})

@app.route('/quiz/<slug>')
def public_quiz(slug):
    quiz = Quiz.query.filter_by(slug=slug, is_public=True).first_or_404()
    try:
        questions = json.loads(quiz.questions)
    except (json.JSONDecodeError, TypeError):
        questions = eval(quiz.questions)
    return render_template("public_quiz.html", quiz=quiz, questions=questions)

@app.route('/submit-score/<slug>', methods=['POST'])
def submit_score(slug):
    quiz = Quiz.query.filter_by(slug=slug, is_public=True).first_or_404()
    data = request.json
    entry = LeaderboardEntry(
        quiz_id=quiz.id,
        participant_name=data.get('name', 'Anonymous'),
        score=data.get('score'),
        total_questions=data.get('total_questions'),
        time_taken=data.get('time_taken')
    )
    db.session.add(entry)
    db.session.commit()
    return jsonify({"message": "Score submitted successfully"})

@app.route('/leaderboard/<slug>')
def leaderboard(slug):
    quiz = Quiz.query.filter_by(slug=slug, is_public=True).first_or_404()
    entries = LeaderboardEntry.query.filter_by(quiz_id=quiz.id).order_by(
        LeaderboardEntry.score.desc(), LeaderboardEntry.time_taken
    ).all()
    return jsonify([
        {
            "name": e.participant_name,
            "score": e.score,
            "total_questions": e.total_questions,
            "time_taken": e.time_taken,
        } for e in entries
    ])

# === Main Execution ===
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)
