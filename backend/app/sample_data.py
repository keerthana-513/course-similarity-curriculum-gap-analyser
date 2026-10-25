"""Sample data loader with realistic course descriptions and benchmark curricula."""
import json
from datetime import datetime
from app.database import get_db_connection

SAMPLE_COURSES = [
    {
        "course_id": "CS101",
        "name": "Introduction to Python Programming",
        "department": "Computer Science",
        "semester": "Semester 1",
        "description": (
            "This course provides a comprehensive introduction to computer programming using Python. "
            "Students will learn fundamental programming constructs including variables, control flow, functions, and data structures. "
            "Practical exercises emphasize algorithm design, file I/O operations, and basic object-oriented programming principles. "
            "By the end of the semester, students will develop practical scripts to automate computational tasks."
        ),
        "syllabus_topics": [
            "Python Programming Syntax and Variables",
            "Conditional Logic and Control Flow",
            "Functions and Modular Code Design",
            "Data Structures: Lists, Tuples, Dictionaries",
            "File Handling and Stream I/O",
            "Introduction to Object-Oriented Programming",
            "Basic Algorithm Implementation",
            "Error and Exception Handling",
        ],
    },
    {
        "course_id": "CS201",
        "name": "Data Structures and Algorithms",
        "department": "Computer Science",
        "semester": "Semester 3",
        "description": (
            "An in-depth study of abstract data types and the algorithms that operate on them. "
            "The curriculum covers linear structures like stacks and queues, as well as non-linear structures including trees and graphs. "
            "Students analyze asymptotic complexity using Big-O notation for sorting and searching procedures. "
            "Rigorous programming assignments reinforce memory management and algorithmic problem-solving."
        ),
        "syllabus_topics": [
            "Asymptotic Complexity and Big-O Notation",
            "Arrays, Linked Lists, and Pointer Manipulation",
            "Stacks, Queues, and Deques",
            "Binary Search Trees and Balanced Trees (AVL, Red-Black)",
            "Priority Queues and Heaps",
            "Sorting and Searching Algorithms",
            "Graph Representations and Traversals (BFS, DFS)",
            "Dynamic Programming and Greedy Algorithms",
        ],
    },
    {
        "course_id": "CS301",
        "name": "Database Management Systems",
        "department": "Computer Science",
        "semester": "Semester 5",
        "description": (
            "Fundamental concepts of database design, implementation, and management in enterprise environments. "
            "Topics include relational algebra, schema normalization up to Boyce-Codd normal form, and expressive SQL queries. "
            "The course investigates storage engines, B-tree indexing, query optimization, and transaction handling under ACID constraints. "
            "Students construct a fully functional web-backed relational database application."
        ),
        "syllabus_topics": [
            "Database Systems and Architecture",
            "Relational Data Model and Relational Algebra",
            "Structured Query Language (SQL)",
            "Entity-Relationship Modeling and Schema Normalization",
            "Indexing Strategies and B-Trees",
            "Query Execution and Optimization",
            "Transaction Management and ACID Properties",
            "Concurrency Control and Recovery Mechanisms",
        ],
    },
    {
        "course_id": "DS101",
        "name": "Statistics and Probability",
        "department": "Data Science",
        "semester": "Semester 1",
        "description": (
            "Foundational mathematical and probabilistic tools for data analysis and scientific reasoning. "
            "Students study probability theory, discrete and continuous random variables, and sampling distributions. "
            "Inferential statistics encompasses point estimation, confidence intervals, and parametric hypothesis testing. "
            "Practical laboratory sessions utilize statistical packages to validate theoretical concepts against real datasets."
        ),
        "syllabus_topics": [
            "Probability Theory and Axioms",
            "Random Variables and Probability Distributions",
            "Expected Value, Variance, and Moments",
            "Sampling Distributions and Central Limit Theorem",
            "Point and Interval Estimation",
            "Hypothesis Testing and p-values",
            "Linear Correlation and Bivariate Regression",
            "Bayesian Probability and Inference",
        ],
    },
    {
        "course_id": "DS201",
        "name": "Data Preprocessing and Visualization",
        "department": "Data Science",
        "semester": "Semester 3",
        "description": (
            "Techniques for transforming noisy, unstructured raw datasets into clean formats ready for analytical modeling. "
            "Students practice handling missing values, identifying anomalous outliers, and executing feature scaling and transformation. "
            "Visual communication principles are mastered using exploratory data analysis tools and plotting frameworks. "
            "Course projects produce interactive dashboards and publication-grade empirical visualizations."
        ),
        "syllabus_topics": [
            "Data Wrangling and Cleansing",
            "Missing Value Imputation and Outlier Detection",
            "Feature Scaling, Normalization, and Encoding",
            "Exploratory Data Analysis (EDA) Workflows",
            "Data Visualization Principles and Color Theory",
            "Interactive Visualizations with Plotly and Seaborn",
            "High-Dimensional Data Projections",
            "Dashboard Creation and Visual Storytelling",
        ],
    },
    {
        "course_id": "DS301",
        "name": "Machine Learning Fundamentals",
        "department": "Data Science",
        "semester": "Semester 5",
        "description": (
            "A core introduction to supervised and unsupervised machine learning algorithms using Python data science libraries. "
            "Students build predictive models with linear regression, logistic regression, decision trees, random forests, and support vector machines. "
            "Unsupervised learning covers k-means clustering and dimensionality reduction techniques. "
            "Model evaluation focuses on cross-validation, ROC-AUC, precision, recall, regularization, and overfitting prevention. "
            "Hands-on labs guide students through end-to-end supervised learning workflows and machine learning pipelines."
        ),
        "syllabus_topics": [
            "Supervised Learning Workflows and Pipelines",
            "Linear and Logistic Regression for Predictive Modeling",
            "Decision Trees and Random Forest Ensembles",
            "Support Vector Machines and Kernel Tricks",
            "Unsupervised Learning: K-Means and Hierarchical Clustering",
            "Model Evaluation: Precision, Recall, F1, ROC-AUC",
            "Cross-Validation and Hyperparameter Tuning",
            "Bias-Variance Tradeoff and Regularization (L1/L2)",
            "Dimensionality Reduction with PCA",
            "Feature Selection and Overfitting Prevention",
        ],
    },
    {
        "course_id": "AI101",
        "name": "Introduction to Artificial Intelligence",
        "department": "Artificial Intelligence",
        "semester": "Semester 1",
        "description": (
            "Broad overview of historical and modern concepts underlying autonomous and rational agents. "
            "Covers classical search algorithms, informed heuristic searches, game theory, and constraint satisfaction problems. "
            "Students also study knowledge representation, first-order propositional logic, and automated reasoning mechanisms. "
            "The curriculum concludes with an introduction to probabilistic reasoning under uncertainty."
        ),
        "syllabus_topics": [
            "History and Foundations of Artificial Intelligence",
            "Intelligent Agent Architectures",
            "Uninformed and Heuristic Search Algorithms (A*, Greedy)",
            "Adversarial Search and Minimax with Alpha-Beta Pruning",
            "Constraint Satisfaction Problems",
            "Propositional and First-Order Logic",
            "Knowledge Representation and Ontologies",
            "Probabilistic Reasoning and Bayesian Networks",
        ],
    },
    {
        "course_id": "AI201",
        "name": "Neural Networks and Deep Learning",
        "department": "Artificial Intelligence",
        "semester": "Semester 3",
        "description": (
            "Theoretical grounding and practical implementation of artificial neural networks and deep learning architectures. "
            "Students implement multilayer perceptrons, backpropagation, and gradient descent optimization with Adam and RMSProp. "
            "The course covers convolutional neural networks (CNNs) for image classification and recurrent neural networks (RNNs) with LSTMs for sequences. "
            "Training challenges such as vanishing gradients, overfitting, dropout regularization, batch normalization, and weight decay are explored. "
            "Deep learning frameworks are used for hands-on projects in computer vision and natural language processing."
        ),
        "syllabus_topics": [
            "Perceptrons and Multilayer Feedforward Networks",
            "Backpropagation and Gradient Computation",
            "Loss Functions and Activation Functions",
            "Gradient Descent Optimization: Adam, RMSProp, SGD",
            "Convolutional Neural Networks (CNNs) for Image Classification",
            "Recurrent Neural Networks and LSTMs",
            "Regularization: Dropout, Batch Normalization, Weight Decay",
            "Deep Learning Framework Implementation",
            "Transfer Learning and Pretrained Models",
        ],
    },
    {
        "course_id": "AI301",
        "name": "Natural Language Processing",
        "department": "Artificial Intelligence",
        "semester": "Semester 5",
        "description": (
            "Comprehensive study of computational linguistics and statistical models for human language processing. "
            "Topics span tokenization, stemming, lemmatization, TF-IDF representations, and continuous word embeddings like Word2Vec. "
            "Modern sequence models, attention mechanisms, and Transformer architectures are deployed for translation and classification. "
            "Students build sentiment analysis tools, named entity recognition systems, and conversational language models."
        ),
        "syllabus_topics": [
            "Text Preprocessing: Tokenization, Stemming, and Lemmatization",
            "N-Gram Language Models and TF-IDF Weighting",
            "Distributed Word Representations (Word2Vec, GloVe)",
            "Sequence Tagging and Named Entity Recognition (NER)",
            "Sentiment Classification and Text Categorization",
            "Sequence-to-Sequence Models with Attention",
            "Transformer Architectures and Self-Attention",
            "Pretrained Language Models (BERT, GPT)",
        ],
    },
    {
        "course_id": "AI401",
        "name": "Computer Vision",
        "department": "Artificial Intelligence",
        "semester": "Semester 7",
        "description": (
            "Exploration of algorithms enabling machines to process, analyze, and comprehend digital images and video feeds. "
            "Foundations include image filtering, spatial transformations, corner detection, and feature description algorithms. "
            "Advanced modules cover deep learning architectures for object detection, semantic segmentation, and optical flow. "
            "Laboratory assignments involve real-time tracking, 3D reconstruction, and visual scene understanding."
        ),
        "syllabus_topics": [
            "Image Processing Fundamentals and Spatial Filtering",
            "Edge Detection and Corner Extraction (Sobel, Canny, Harris)",
            "Feature Description and Matching (SIFT, ORB)",
            "Deep Convolutional Networks for Image Classification",
            "Object Detection Frameworks (YOLO, Faster R-CNN)",
            "Semantic and Instance Segmentation",
            "Optical Flow and Video Motion Analysis",
            "Generative Models for Image Synthesis",
        ],
    },
    {
        "course_id": "AI501",
        "name": "Explainable AI and AI Ethics",
        "department": "Artificial Intelligence",
        "semester": "Semester 7",
        "description": (
            "Critical examination of transparency, interpretability, and ethical responsibilities in modern intelligent systems. "
            "Students explore algorithmic bias detection, fairness constraints, and accountability standards across automated decision systems. "
            "Model interpretability tools such as SHAP, LIME, counterfactual explanations, and integrated gradients are applied. "
            "The curriculum investigates governance frameworks, privacy safeguards, and societal ramifications of deployed AI."
        ),
        "syllabus_topics": [
            "Foundations of Trustworthy and Responsible AI",
            "Algorithmic Bias, Fairness Metrics, and Parity",
            "Model Interpretability vs Explainability Paradigms",
            "Local Explainability: LIME and Saliency Maps",
            "Global Interpretability and SHAP (Shapley Values)",
            "Data Privacy, Anonymity, and Differential Privacy",
            "AI Safety, Robustness, and Adversarial Vulnerabilities",
            "Regulatory Compliance, Governance, and Ethical Auditing",
        ],
    },
    {
        "course_id": "ML101",
        "name": "Applied Machine Learning",
        "department": "Machine Learning",
        "semester": "Semester 3",
        "description": (
            "A hands-on practical course covering supervised and unsupervised machine learning algorithms and predictive modeling pipelines. "
            "Students build models with linear regression, logistic regression, decision trees, random forests, and support vector machines. "
            "Model evaluation covers cross-validation, ROC-AUC, precision, recall, F1 score, and regularization to prevent overfitting. "
            "Special emphasis on hyperparameter tuning, feature selection, and end-to-end supervised learning workflows using Python data science libraries. "
            "Unsupervised learning topics include k-means clustering and dimensionality reduction with PCA."
        ),
        "syllabus_topics": [
            "Supervised Learning Workflows and Pipelines",
            "Linear and Logistic Regression for Predictive Modeling",
            "Decision Trees and Random Forest Ensembles",
            "Support Vector Machines and Classification",
            "Model Evaluation: Precision, Recall, F1, ROC-AUC",
            "Cross-Validation and Hyperparameter Tuning",
            "Regularization Methods and Overfitting Prevention",
            "Unsupervised Learning: K-Means Clustering",
            "Dimensionality Reduction with PCA",
            "Feature Selection and Machine Learning Deployment",
        ],
    },
    {
        "course_id": "ML201",
        "name": "Advanced Deep Learning",
        "department": "Machine Learning",
        "semester": "Semester 5",
        "description": (
            "An advanced course on deep neural network architectures, optimization, and regularization for complex tasks. "
            "Students build multilayer perceptrons, implement backpropagation from scratch, and study gradient descent with Adam and RMSProp. "
            "Convolutional neural networks (CNNs) with residual connections are applied to image classification and computer vision. "
            "Recurrent neural networks with attention mechanisms and LSTMs are used for sequence modeling. "
            "Advanced topics include generative adversarial networks, dropout, batch normalization, weight decay, and transfer learning."
        ),
        "syllabus_topics": [
            "Multilayer Neural Architectures and Feedforward Computation",
            "Backpropagation and Gradient Computation",
            "Gradient Descent Optimization: Adam, RMSProp, SGD",
            "Convolutional Neural Networks (CNNs) and Deep Residual Networks",
            "Regularization: Dropout, Batch Normalization, Weight Decay",
            "Recurrent Neural Networks and Attention Mechanisms",
            "Generative Adversarial Networks (GANs)",
            "Transfer Learning and Pretrained Models",
            "Distributed Deep Learning and Hardware Acceleration",
        ],
    },
    {
        "course_id": "CS401",
        "name": "Software Engineering",
        "department": "Computer Science",
        "semester": "Semester 7",
        "description": (
            "Principles, practices, and engineering methodologies for delivering large-scale software systems sustainably. "
            "Students engage with Agile development life cycles, Scrum ceremonies, continuous integration, and automated testing suites. "
            "Architectural patterns including microservices, layered designs, and object-oriented design patterns are evaluated. "
            "Teams collaborate using version control, issue tracking, and comprehensive deployment pipelines."
        ),
        "syllabus_topics": [
            "Software Development Methodologies (Agile, Scrum, Kanban)",
            "Requirements Engineering and User Story Mapping",
            "Architectural Design Patterns and Microservices",
            "Object-Oriented Design and SOLID Principles",
            "Unit, Integration, and System Testing Strategies",
            "Continuous Integration and Continuous Deployment (CI/CD)",
            "Version Control Workflows and Code Review Practices",
            "Software Maintenance, Refactoring, and Technical Debt",
        ],
    },
]

DEFAULT_CURRICULUM = {
    "name": "Standard AI & Data Science Curriculum",
    "department": "Computer Science & AI",
    "topics": [
        "Python Programming",
        "Statistics and Probability",
        "Data Preprocessing",
        "Data Visualization",
        "Machine Learning Fundamentals",
        "Supervised Learning",
        "Unsupervised Learning",
        "Neural Networks",
        "Deep Learning",
        "Natural Language Processing",
        "Computer Vision",
        "Explainable AI",
        "AI Ethics",
        "Database Systems",
        "Software Engineering",
        "Reinforcement Learning",
        "Big Data Analytics",
        "Cloud Computing",
    ],
}


def load_sample_data(force: bool = False) -> dict:
    """Insert sample courses and default benchmark curriculum into database."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Check existing courses
        cursor.execute("SELECT COUNT(*) AS count FROM courses;")
        course_count = cursor.fetchone()["count"]

        inserted_courses = 0
        now_str = datetime.utcnow().isoformat()

        if course_count == 0 or force:
            if force:
                cursor.execute("DELETE FROM courses;")

            for course in SAMPLE_COURSES:
                syllabus_json = json.dumps(course["syllabus_topics"])
                cursor.execute(
                    """
                    INSERT INTO courses (course_id, name, department, semester, description, syllabus_topics, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        course["course_id"],
                        course["name"],
                        course["department"],
                        course["semester"],
                        course["description"],
                        syllabus_json,
                        now_str,
                        now_str,
                    ),
                )
                inserted_courses += 1

        # Check existing reference curricula
        cursor.execute("SELECT COUNT(*) AS count FROM reference_curricula;")
        curricula_count = cursor.fetchone()["count"]
        inserted_curricula = 0

        if curricula_count == 0 or force:
            if force:
                cursor.execute("DELETE FROM reference_curricula;")

            topics_json = json.dumps(DEFAULT_CURRICULUM["topics"])
            cursor.execute(
                """
                INSERT INTO reference_curricula (name, department, topics, created_at)
                VALUES (?, ?, ?, ?);
                """,
                (
                    DEFAULT_CURRICULUM["name"],
                    DEFAULT_CURRICULUM["department"],
                    topics_json,
                    now_str,
                ),
            )
            inserted_curricula += 1

        conn.commit()
        return {
            "status": "success",
            "inserted_courses": inserted_courses,
            "inserted_curricula": inserted_curricula,
        }
    finally:
        conn.close()
