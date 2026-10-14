// Seed data for StudyNest. Everything here is mock course material that the
// frontend uses until a real backend (ingestion, retrieval, learner model) is wired in.

export type Theme = 'blue' | 'yellow' | 'coral' | 'green' | 'purple' | 'pink';
export type LessonType = 'video' | 'pdf' | 'slides' | 'notes';
export type SubjectIcon = 'doc' | 'pi' | 'python' | 'code' | 'network' | 'book' | 'brain' | 'flask';

export interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  meta: string;
  progress: number; // 0-100
  bookmarked?: boolean;
  concepts: string[];
  source: string; // where this lesson came from (file + location)
  content: string;
}

export interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Subject {
  id: string;
  name: string;
  icon: SubjectIcon;
  theme: Theme;
  modules: Module[];
}

export interface Concept {
  id: string;
  name: string;
  subjectId: string;
  lessonId?: string;
  source: string;
  summary: string;
}

export type ResourceKind = 'pdf' | 'video' | 'slides' | 'notes' | 'image' | 'web' | 'audio' | 'youtube';

export interface Resource {
  id: string;
  name: string;
  kind: ResourceKind;
  meta: string;
  date: string;
  status: 'ready' | 'processing';
  text?: string; // raw text for user-provided notes — becomes retrievable chunks
  url?: string;
}

export interface Chunk {
  id: string;
  resourceId: string;
  location: string; // "p. 34", "Slide 12", "12:40"
  topic: string;
  keywords: string[];
  text: string;
}

export interface Question {
  id: string;
  subjectId: string;
  concept: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  type: 'mcq' | 'numeric' | 'short';
  prompt: string;
  options?: string[];
  answer: number | string; // index for mcq, value for numeric/short
  accept?: string[]; // keywords accepted for short answers
  explanation: string;
  source: string;
}

let lessonSeq = 0;
function lesson(
  title: string,
  type: LessonType,
  meta: string,
  progress: number,
  concepts: string[] = [],
  source = '',
  content = '',
): Lesson {
  lessonSeq += 1;
  return {
    id: `l${lessonSeq}`,
    title,
    type,
    meta,
    progress,
    concepts,
    source: source || meta,
    content:
      content ||
      `${title} — this unit walks through the core ideas, worked examples and common pitfalls. ` +
        `Every explanation is linked back to its source location so you can jump straight to the page, slide or timestamp it came from.`,
  };
}

export const seedSubjects: Subject[] = [
  {
    id: 'ds',
    name: 'Data Science',
    icon: 'doc',
    theme: 'blue',
    modules: [
      {
        id: 'ds-1',
        title: 'Introduction to Data Science',
        lessons: [
          lesson('What is Data Science?', 'video', 'Video • 12 min', 100, ['ds-lifecycle'], 'Lecture 1 - Intro.mp4 • 00:00–12:10',
            'Data science combines statistics, programming and domain knowledge to extract insight from data. The lecture frames it as a loop: ask a question, collect data, clean it, explore it, model it, and communicate the result.'),
          lesson('Applications and Real World Examples', 'pdf', 'PDF • Page 4–10', 100, [], 'Machine Learning.pdf • p. 4–10',
            'Recommendation systems, fraud detection, demand forecasting and medical imaging are the four running case studies used throughout the course.'),
          lesson('Types of Data', 'slides', 'Slides • Slide 8–15', 100, ['data-types'], 'Neural Networks Slides.pptx • Slide 8–15',
            'Data is structured (tables), semi-structured (JSON, logs) or unstructured (text, images, audio). Variables are numerical (continuous / discrete) or categorical (nominal / ordinal).'),
          lesson('Data Science Lifecycle', 'notes', 'Notes', 100, ['ds-lifecycle'], 'Notes - Lifecycle',
            'Problem definition → data collection → preparation → exploration → modelling → evaluation → deployment → monitoring. Each stage can loop back to an earlier one.'),
        ],
      },
      {
        id: 'ds-2',
        title: 'Data Collection and Preprocessing',
        lessons: [
          lesson('Data Sources & Collection', 'video', 'Video • 15 min', 100, [], 'Lecture 2 - Data.mp4 • 00:00–15:02'),
          lesson('Handling Missing Values', 'pdf', 'PDF • Page 22–29', 100, ['missing-values'], 'Machine Learning.pdf • p. 22–29',
            'Missing values can be dropped, imputed with mean/median/mode, or predicted from other features. Always check whether data is missing at random before imputing.'),
          lesson('Feature Scaling & Encoding', 'slides', 'Slides • Slide 16–24', 100, ['feature-scaling'], 'Neural Networks Slides.pptx • Slide 16–24',
            'Standardisation rescales to zero mean and unit variance; min-max scaling maps to [0, 1]. Categorical features are one-hot or ordinal encoded.'),
          lesson('Data Cleaning Pipelines', 'notes', 'Notes', 0, ['missing-values'], 'Notes - Cleaning'),
        ],
      },
      {
        id: 'ds-3',
        title: 'Exploratory Data Analysis',
        lessons: [
          lesson('Descriptive Statistics', 'video', 'Video • 14 min', 100, ['descriptive-stats'], 'Lecture 3 - EDA.mp4 • 00:00–14:20'),
          lesson('Data Visualization Basics', 'slides', 'Slides • Slide 25–33', 100, [], 'Neural Networks Slides.pptx • Slide 25–33'),
          lesson('Correlation Analysis', 'pdf', 'PDF • Page 41–48', 100, ['correlation'], 'Machine Learning.pdf • p. 41–48',
            'Pearson correlation measures linear association between −1 and 1. Correlation does not imply causation; always plot the data.'),
          lesson('Outlier Detection', 'video', 'Video • 9 min', 0, ['descriptive-stats'], 'Lecture 3 - EDA.mp4 • 14:20–23:30'),
          lesson('EDA Case Study', 'notes', 'Notes', 0, [], 'Notes - EDA'),
        ],
      },
      {
        id: 'ds-4',
        title: 'Machine Learning',
        lessons: [
          lesson('Introduction to Machine Learning', 'video', 'Video • 18 min', 68, ['supervised'], 'Lecture 1 - Intro.mp4 • 12:10–30:40',
            'Machine learning lets a program improve at a task from data instead of explicit rules. Supervised learning learns from labelled examples, unsupervised learning finds structure in unlabelled data, and reinforcement learning learns from rewards.'),
          lesson('Decision Trees', 'slides', 'Slides • Slide 34–42', 0, ['decision-trees'], 'Neural Networks Slides.pptx • Slide 34–42',
            'A decision tree splits data on the feature that most reduces impurity (Gini or entropy) at each node. Deep trees overfit; limit depth or prune.'),
          lesson('Train-Test Split', 'video', 'Video • 10 min', 100, ['train-test'], 'Lecture 4 - Models.mp4 • 03:15–13:00',
            'Hold out a test set (commonly 20–30%) the model never sees during training so you can estimate generalisation honestly.'),
          lesson('Linear Regression', 'pdf', 'PDF • Page 55–63', 32, ['linear-regression'], 'Machine Learning.pdf • p. 55–63',
            'Linear regression fits y = wx + b by minimising mean squared error. Coefficients show how much the prediction changes per unit of each feature.'),
          lesson('Classification vs Regression', 'video', 'Video • 11 min', 0, ['class-vs-reg'], 'Lecture 4 - Models.mp4 • 13:00–24:10',
            'Regression predicts a continuous quantity (price, temperature). Classification predicts a discrete label (spam / not spam). The output type, not the input, decides which one you need.'),
        ],
      },
      {
        id: 'ds-5',
        title: 'Model Evaluation',
        lessons: [
          lesson('Evaluation Metrics', 'video', 'Video • 13 min', 100, ['metrics'], 'Lecture 5 - Evaluation.mp4 • 00:00–13:05'),
          lesson('Confusion Matrix', 'slides', 'Slides • Slide 43–50', 0, ['confusion-matrix'], 'Neural Networks Slides.pptx • Slide 43–50'),
          lesson('Cross Validation', 'pdf', 'PDF • Page 70–78', 0, ['cross-validation'], 'Machine Learning.pdf • p. 70–78'),
          lesson('Bias–Variance Trade-off', 'video', 'Video • 16 min', 0, ['overfitting'], 'Lecture 5 - Evaluation.mp4 • 13:05–29:00'),
          lesson('ROC Curves and AUC', 'notes', 'Notes', 0, ['metrics'], 'Notes - ROC'),
        ],
      },
      {
        id: 'ds-6',
        title: 'Deployment',
        lessons: [
          lesson('Model Serving Basics', 'video', 'Video • 14 min', 0, [], 'Lecture 6 - Deploy.mp4 • 00:00–14:00'),
          lesson('Monitoring Models in Production', 'pdf', 'PDF • Page 90–96', 0, [], 'Machine Learning.pdf • p. 90–96'),
        ],
      },
    ],
  },
  {
    id: 'math',
    name: 'Mathematics',
    icon: 'pi',
    theme: 'yellow',
    modules: [
      {
        id: 'math-1',
        title: 'Linear Algebra',
        lessons: [
          lesson('Vectors and Matrices', 'video', 'Video • 16 min', 100, ['matrices'], 'Math Lecture 1.mp4 • 00:00–16:00'),
          lesson('Matrix Multiplication', 'pdf', 'PDF • Page 12–18', 100, ['matrices'], 'Linear Algebra.pdf • p. 12–18'),
          lesson('Eigenvalues and Eigenvectors', 'slides', 'Slides • Slide 20–31', 40, ['eigen'], 'Math Slides.pptx • Slide 20–31'),
        ],
      },
      {
        id: 'math-2',
        title: 'Probability',
        lessons: [
          lesson('Probability Basics', 'video', 'Video • 12 min', 100, ['probability'], 'Math Lecture 3.mp4 • 00:00–12:00'),
          lesson("Bayes' Theorem", 'pdf', 'PDF • Page 40–46', 60, ['bayes'], 'Probability.pdf • p. 40–46'),
          lesson('Distributions', 'slides', 'Slides • Slide 5–14', 0, ['probability'], 'Math Slides.pptx • Slide 5–14'),
        ],
      },
      {
        id: 'math-3',
        title: 'Calculus for ML',
        lessons: [
          lesson('Derivatives', 'video', 'Video • 15 min', 100, ['derivatives'], 'Math Lecture 5.mp4 • 00:00–15:00'),
          lesson('Gradients and Chain Rule', 'notes', 'Notes', 0, ['derivatives'], 'Notes - Chain rule'),
        ],
      },
    ],
  },
  {
    id: 'python',
    name: 'Python',
    icon: 'python',
    theme: 'coral',
    modules: [
      {
        id: 'py-1',
        title: 'Python Fundamentals',
        lessons: [
          lesson('Variables and Types', 'video', 'Video • 10 min', 100, ['py-basics'], 'Python Lecture 1.mp4 • 00:00–10:00'),
          lesson('Control Flow', 'video', 'Video • 12 min', 100, ['py-basics'], 'Python Lecture 2.mp4 • 00:00–12:00'),
          lesson('Functions', 'pdf', 'PDF • Page 30–38', 100, ['py-functions'], 'Python Book.pdf • p. 30–38'),
        ],
      },
      {
        id: 'py-2',
        title: 'Data Structures',
        lessons: [
          lesson('Lists and Tuples', 'slides', 'Slides • Slide 1–12', 100, ['py-collections'], 'Python Slides.pptx • Slide 1–12'),
          lesson('Dictionaries and Sets', 'slides', 'Slides • Slide 13–22', 50, ['py-collections'], 'Python Slides.pptx • Slide 13–22'),
        ],
      },
      {
        id: 'py-3',
        title: 'Libraries for Data',
        lessons: [
          lesson('NumPy Essentials', 'video', 'Video • 20 min', 40, ['numpy'], 'Python Lecture 6.mp4 • 00:00–20:00'),
          lesson('Pandas DataFrames', 'notes', 'Notes', 0, ['pandas'], 'Notes - Pandas'),
        ],
      },
    ],
  },
  {
    id: 'web',
    name: 'Web Development',
    icon: 'code',
    theme: 'green',
    modules: [
      {
        id: 'web-1',
        title: 'HTML & CSS',
        lessons: [
          lesson('Semantic HTML', 'video', 'Video • 11 min', 100, ['html'], 'Web Lecture 1.mp4 • 00:00–11:00'),
          lesson('Flexbox and Grid', 'slides', 'Slides • Slide 4–19', 60, ['css-layout'], 'Web Slides.pptx • Slide 4–19'),
        ],
      },
      {
        id: 'web-2',
        title: 'JavaScript',
        lessons: [
          lesson('DOM Manipulation', 'video', 'Video • 14 min', 40, ['dom'], 'Web Lecture 3.mp4 • 00:00–14:00'),
          lesson('Async and Fetch', 'pdf', 'PDF • Page 60–70', 0, ['async'], 'JS Guide.pdf • p. 60–70'),
          lesson('React Basics', 'notes', 'Notes', 0, [], 'Notes - React'),
        ],
      },
    ],
  },
  {
    id: 'cn',
    name: 'Computer Networks',
    icon: 'network',
    theme: 'purple',
    modules: [
      {
        id: 'cn-1',
        title: 'Network Models',
        lessons: [
          lesson('OSI Model', 'video', 'Video • 15 min', 100, ['osi'], 'CN Lecture 1.mp4 • 00:00–15:00'),
          lesson('TCP/IP Stack', 'pdf', 'PDF • Page 20–31', 50, ['tcp'], 'Networks.pdf • p. 20–31'),
        ],
      },
      {
        id: 'cn-2',
        title: 'Transport & Routing',
        lessons: [
          lesson('TCP vs UDP', 'slides', 'Slides • Slide 10–18', 0, ['tcp'], 'CN Slides.pptx • Slide 10–18'),
          lesson('Routing Algorithms', 'video', 'Video • 18 min', 0, ['routing'], 'CN Lecture 4.mp4 • 00:00–18:00'),
        ],
      },
    ],
  },
];

export const concepts: Concept[] = [
  { id: 'class-vs-reg', name: 'Classification vs Regression', subjectId: 'ds', source: 'Lecture 4 - Models.mp4 • 13:00', summary: 'Regression predicts continuous values; classification predicts discrete labels.' },
  { id: 'supervised', name: 'Supervised Learning', subjectId: 'ds', source: 'Lecture 1 - Intro.mp4 • 14:32', summary: 'Learning a mapping from inputs to labelled outputs.' },
  { id: 'decision-trees', name: 'Decision Trees', subjectId: 'ds', source: 'Slides • Slide 34', summary: 'Recursive splits on features that reduce impurity.' },
  { id: 'train-test', name: 'Train-Test Split', subjectId: 'ds', source: 'Lecture 4 - Models.mp4 • 03:15', summary: 'Holding out unseen data to estimate generalisation.' },
  { id: 'linear-regression', name: 'Linear Regression', subjectId: 'ds', source: 'Machine Learning.pdf • p. 55', summary: 'Fitting a line by minimising squared error.' },
  { id: 'overfitting', name: 'Overfitting & Bias–Variance', subjectId: 'ds', source: 'Lecture 5 - Evaluation.mp4 • 13:05', summary: 'Too-flexible models memorise noise and fail on new data.' },
  { id: 'metrics', name: 'Evaluation Metrics', subjectId: 'ds', source: 'Lecture 5 - Evaluation.mp4 • 02:40', summary: 'Accuracy, precision, recall, F1 and when each matters.' },
  { id: 'confusion-matrix', name: 'Confusion Matrix', subjectId: 'ds', source: 'Slides • Slide 43', summary: 'Counts of TP, FP, TN, FN for a classifier.' },
  { id: 'cross-validation', name: 'Cross Validation', subjectId: 'ds', source: 'Machine Learning.pdf • p. 70', summary: 'Rotating validation folds for a more stable estimate.' },
  { id: 'missing-values', name: 'Missing Values', subjectId: 'ds', source: 'Machine Learning.pdf • p. 22', summary: 'Dropping vs imputing incomplete records.' },
  { id: 'feature-scaling', name: 'Feature Scaling', subjectId: 'ds', source: 'Slides • Slide 16', summary: 'Standardisation and min-max normalisation.' },
  { id: 'correlation', name: 'Correlation', subjectId: 'ds', source: 'Machine Learning.pdf • p. 41', summary: 'Strength of linear association between two variables.' },
  { id: 'descriptive-stats', name: 'Descriptive Statistics', subjectId: 'ds', source: 'Lecture 3 - EDA.mp4 • 01:10', summary: 'Mean, median, variance and spread.' },
  { id: 'data-types', name: 'Types of Data', subjectId: 'ds', source: 'Slides • Slide 8', summary: 'Structured, semi-structured and unstructured data.' },
  { id: 'ds-lifecycle', name: 'Data Science Lifecycle', subjectId: 'ds', source: 'Notes - Lifecycle', summary: 'The iterative stages of a data project.' },
  { id: 'matrices', name: 'Matrices', subjectId: 'math', source: 'Linear Algebra.pdf • p. 12', summary: 'Rectangular arrays and their operations.' },
  { id: 'eigen', name: 'Eigenvalues', subjectId: 'math', source: 'Math Slides.pptx • Slide 20', summary: 'Directions a matrix only stretches.' },
  { id: 'probability', name: 'Probability', subjectId: 'math', source: 'Math Lecture 3.mp4 • 02:00', summary: 'Quantifying uncertainty between 0 and 1.' },
  { id: 'bayes', name: "Bayes' Theorem", subjectId: 'math', source: 'Probability.pdf • p. 40', summary: 'Updating beliefs with evidence.' },
  { id: 'derivatives', name: 'Derivatives', subjectId: 'math', source: 'Math Lecture 5.mp4 • 03:30', summary: 'Instantaneous rate of change.' },
  { id: 'py-basics', name: 'Python Basics', subjectId: 'python', source: 'Python Lecture 1.mp4 • 01:00', summary: 'Variables, types and control flow.' },
  { id: 'py-functions', name: 'Functions', subjectId: 'python', source: 'Python Book.pdf • p. 30', summary: 'Reusable blocks of code with parameters.' },
  { id: 'py-collections', name: 'Collections', subjectId: 'python', source: 'Python Slides.pptx • Slide 1', summary: 'Lists, tuples, dicts and sets.' },
  { id: 'numpy', name: 'NumPy', subjectId: 'python', source: 'Python Lecture 6.mp4 • 02:00', summary: 'Vectorised array computing.' },
  { id: 'pandas', name: 'Pandas', subjectId: 'python', source: 'Notes - Pandas', summary: 'Tabular data manipulation.' },
  { id: 'html', name: 'Semantic HTML', subjectId: 'web', source: 'Web Lecture 1.mp4 • 00:40', summary: 'Meaningful markup for structure and accessibility.' },
  { id: 'css-layout', name: 'CSS Layout', subjectId: 'web', source: 'Web Slides.pptx • Slide 4', summary: 'Flexbox and grid layout systems.' },
  { id: 'dom', name: 'The DOM', subjectId: 'web', source: 'Web Lecture 3.mp4 • 01:20', summary: 'The browser’s tree model of a page.' },
  { id: 'async', name: 'Async JavaScript', subjectId: 'web', source: 'JS Guide.pdf • p. 60', summary: 'Promises, async/await and fetch.' },
  { id: 'osi', name: 'OSI Model', subjectId: 'cn', source: 'CN Lecture 1.mp4 • 00:50', summary: 'Seven-layer reference model.' },
  { id: 'tcp', name: 'TCP / UDP', subjectId: 'cn', source: 'Networks.pdf • p. 20', summary: 'Reliable vs connectionless transport.' },
  { id: 'routing', name: 'Routing', subjectId: 'cn', source: 'CN Lecture 4.mp4 • 02:00', summary: 'How packets find a path.' },
];

// Link each concept to the first lesson that teaches it.
for (const c of concepts) {
  for (const s of seedSubjects)
    for (const m of s.modules)
      for (const l of m.lessons)
        if (!c.lessonId && l.concepts.includes(c.id)) c.lessonId = l.id;
}

// Starting per-concept mastery (probability the student knows it — BKT style).
export const seedMastery: Record<string, number> = {
  'class-vs-reg': 0.2, supervised: 0.62, 'decision-trees': 0.4, 'train-test': 0.86, 'linear-regression': 0.55,
  overfitting: 0.45, metrics: 0.7, 'confusion-matrix': 0.5, 'cross-validation': 0.38, 'missing-values': 0.8,
  'feature-scaling': 0.78, correlation: 0.74, 'descriptive-stats': 0.82, 'data-types': 0.9, 'ds-lifecycle': 0.92,
  matrices: 0.8, eigen: 0.42, probability: 0.75, bayes: 0.48, derivatives: 0.7,
  'py-basics': 0.92, 'py-functions': 0.85, 'py-collections': 0.7, numpy: 0.5, pandas: 0.35,
  html: 0.85, 'css-layout': 0.6, dom: 0.5, async: 0.3, osi: 0.75, tcp: 0.5, routing: 0.25,
};

export const seedResources: Resource[] = [
  { id: 'r1', name: 'Machine Learning.pdf', kind: 'pdf', meta: '120 pages', date: 'Oct 8, 2026', status: 'ready' },
  { id: 'r2', name: 'Lecture 1 - Intro.mp4', kind: 'video', meta: '32:10', date: 'Oct 8, 2026', status: 'ready' },
  { id: 'r3', name: 'Neural Networks Slides.pptx', kind: 'slides', meta: '45 slides', date: 'Oct 6, 2026', status: 'ready' },
  { id: 'r4', name: 'Notes - Backpropagation', kind: 'notes', meta: '12 pages', date: 'Oct 5, 2026', status: 'ready' },
  { id: 'r5', name: 'CNN Images.png', kind: 'image', meta: '5 images', date: 'Oct 4, 2026', status: 'ready' },
  { id: 'r6', name: 'Lecture 4 - Models.mp4', kind: 'video', meta: '41:52', date: 'Oct 2, 2026', status: 'ready' },
  { id: 'r7', name: 'Lecture 5 - Evaluation.mp4', kind: 'video', meta: '29:00', date: 'Sep 30, 2026', status: 'ready' },
];

// The searchable knowledge base: small, source-located excerpts.
export const seedChunks: Chunk[] = [
  { id: 'c1', resourceId: 'r4', location: 'p. 2', topic: 'Backpropagation', keywords: ['backpropagation', 'backprop', 'gradient', 'chain', 'rule', 'weights', 'error'],
    text: 'Backpropagation computes the gradient of the loss with respect to every weight by applying the chain rule layer by layer, starting from the output and moving backwards.' },
  { id: 'c2', resourceId: 'r3', location: 'Slide 18', topic: 'Backpropagation', keywords: ['backpropagation', 'forward', 'backward', 'pass', 'diagram', 'update'],
    text: 'The diagram on slide 18 shows the two phases: a forward pass that produces predictions and the loss, then a backward pass that sends error signals to earlier layers so each weight can be updated.' },
  { id: 'c3', resourceId: 'r1', location: 'p. 34', topic: 'Gradient Descent', keywords: ['gradient', 'descent', 'learning', 'rate', 'optimization', 'loss', 'minimum'],
    text: 'Gradient descent updates parameters in the direction of the negative gradient: w ← w − η·∂L/∂w. The learning rate η controls step size; too large diverges, too small is slow.' },
  { id: 'c4', resourceId: 'r3', location: 'Slide 6', topic: 'Neural Networks', keywords: ['neural', 'network', 'networks', 'neuron', 'layer', 'layers', 'hidden', 'perceptron'],
    text: 'A neural network stacks layers of neurons. Each neuron computes a weighted sum of its inputs plus a bias and passes it through a non-linear activation function.' },
  { id: 'c5', resourceId: 'r3', location: 'Slide 11', topic: 'Activation Functions', keywords: ['activation', 'relu', 'sigmoid', 'tanh', 'nonlinear', 'non-linear', 'function'],
    text: 'ReLU (max(0, x)) is the default activation for hidden layers because it avoids vanishing gradients; sigmoid squashes to (0, 1) and is used for binary outputs.' },
  { id: 'c6', resourceId: 'r7', location: '13:05', topic: 'Overfitting', keywords: ['overfitting', 'overfit', 'bias', 'variance', 'generalization', 'generalisation', 'regularization'],
    text: 'Overfitting happens when a model learns noise in the training data: training error keeps falling while validation error rises. This is the high-variance end of the bias–variance trade-off.' },
  { id: 'c7', resourceId: 'r1', location: 'p. 58', topic: 'Regularization', keywords: ['regularization', 'regularisation', 'l1', 'l2', 'dropout', 'penalty', 'overfitting'],
    text: 'L2 regularisation adds λ·Σw² to the loss, shrinking weights toward zero; dropout randomly disables neurons during training. Both reduce overfitting.' },
  { id: 'c8', resourceId: 'r5', location: 'Image 2', topic: 'CNN', keywords: ['cnn', 'convolution', 'convolutional', 'filter', 'kernel', 'feature', 'map', 'image', 'images'],
    text: 'Image 2 (extracted diagram) shows a 3×3 kernel sliding over the input image to produce a feature map — each output pixel is the dot product of the kernel with a local patch.' },
  { id: 'c9', resourceId: 'r5', location: 'Image 4', topic: 'CNN', keywords: ['pooling', 'max', 'cnn', 'downsample', 'stride'],
    text: 'Image 4 illustrates 2×2 max pooling with stride 2, which halves the spatial size of the feature map while keeping the strongest activation in each window.' },
  { id: 'c10', resourceId: 'r2', location: '14:32', topic: 'Supervised Learning', keywords: ['supervised', 'unsupervised', 'labels', 'labelled', 'labeled', 'machine', 'learning', 'ml'],
    text: 'Supervised learning trains on labelled examples (input, correct output). Unsupervised learning has no labels and instead looks for structure such as clusters.' },
  { id: 'c11', resourceId: 'r6', location: '13:40', topic: 'Classification vs Regression', keywords: ['classification', 'regression', 'continuous', 'discrete', 'label', 'predict'],
    text: 'Regression predicts a continuous number such as a house price; classification predicts a category such as spam / not spam. Logistic regression, despite its name, is a classifier.' },
  { id: 'c12', resourceId: 'r6', location: '03:15', topic: 'Train-Test Split', keywords: ['train', 'test', 'split', 'holdout', 'validation', 'data'],
    text: 'Split the data before any fitting: a typical split is 80/20. The test set must stay untouched until the final evaluation, otherwise the reported score is optimistic.' },
  { id: 'c13', resourceId: 'r3', location: 'Slide 34', topic: 'Decision Trees', keywords: ['decision', 'tree', 'trees', 'gini', 'entropy', 'split', 'impurity'],
    text: 'Decision trees choose, at each node, the split that most reduces impurity (Gini or entropy). Limiting max depth or pruning prevents the tree from memorising the training set.' },
  { id: 'c14', resourceId: 'r1', location: 'p. 55', topic: 'Linear Regression', keywords: ['linear', 'regression', 'mse', 'squared', 'error', 'line', 'least'],
    text: 'Linear regression finds weights that minimise mean squared error between predictions and targets; the closed-form least-squares solution is w = (XᵀX)⁻¹Xᵀy.' },
  { id: 'c15', resourceId: 'r7', location: '02:40', topic: 'Evaluation Metrics', keywords: ['accuracy', 'precision', 'recall', 'f1', 'metric', 'metrics', 'evaluation', 'confusion'],
    text: 'Precision = TP / (TP + FP) asks how many predicted positives were right; recall = TP / (TP + FN) asks how many real positives were found. F1 is their harmonic mean.' },
  { id: 'c16', resourceId: 'r1', location: 'p. 70', topic: 'Cross Validation', keywords: ['cross', 'validation', 'k-fold', 'fold', 'folds'],
    text: 'k-fold cross-validation splits the training data into k folds, trains k times on k−1 folds and validates on the remaining one, then averages the scores.' },
];

export const questionBank: Question[] = [
  { id: 'q1', subjectId: 'ds', concept: 'class-vs-reg', difficulty: 'Easy', type: 'mcq',
    prompt: 'Predicting tomorrow’s temperature in °C is an example of…', options: ['Classification', 'Regression', 'Clustering', 'Dimensionality reduction'], answer: 1,
    explanation: 'Temperature is a continuous quantity, so this is regression.', source: 'Lecture 4 - Models.mp4 • 13:40' },
  { id: 'q2', subjectId: 'ds', concept: 'class-vs-reg', difficulty: 'Medium', type: 'mcq',
    prompt: 'Logistic regression is primarily used for…', options: ['Regression of continuous targets', 'Binary classification', 'Clustering', 'Feature scaling'], answer: 1,
    explanation: 'Despite its name, logistic regression outputs class probabilities — it is a classifier.', source: 'Lecture 4 - Models.mp4 • 13:40' },
  { id: 'q3', subjectId: 'ds', concept: 'class-vs-reg', difficulty: 'Medium', type: 'short',
    prompt: 'An email is labelled “spam” or “not spam”. Is this classification or regression?', answer: 'classification', accept: ['classification', 'classifier', 'classify'],
    explanation: 'The output is a discrete label, so this is classification.', source: 'Lecture 4 - Models.mp4 • 13:40' },
  { id: 'q4', subjectId: 'ds', concept: 'train-test', difficulty: 'Easy', type: 'numeric',
    prompt: 'A dataset has 1,000 rows. With an 80/20 train-test split, how many rows go to the test set?', answer: '200',
    explanation: '20% of 1,000 is 200.', source: 'Lecture 4 - Models.mp4 • 03:15' },
  { id: 'q5', subjectId: 'ds', concept: 'train-test', difficulty: 'Medium', type: 'mcq',
    prompt: 'Why should the test set stay untouched until the final evaluation?', options: ['It makes training faster', 'It prevents an optimistic, leaked estimate of performance', 'It reduces model size', 'It removes outliers'], answer: 1,
    explanation: 'Using the test set during development leaks information, so the final score overestimates real performance.', source: 'Lecture 4 - Models.mp4 • 03:15' },
  { id: 'q6', subjectId: 'ds', concept: 'decision-trees', difficulty: 'Medium', type: 'mcq',
    prompt: 'Which criterion is commonly used to choose splits in a decision tree?', options: ['Mean absolute error only', 'Gini impurity or entropy', 'Learning rate', 'Cosine similarity'], answer: 1,
    explanation: 'Classification trees pick the split that most reduces Gini impurity or entropy.', source: 'Neural Networks Slides.pptx • Slide 34' },
  { id: 'q7', subjectId: 'ds', concept: 'decision-trees', difficulty: 'Hard', type: 'mcq',
    prompt: 'A very deep decision tree scores 100% on training data but 68% on test data. What is the best first fix?', options: ['Add more depth', 'Limit max depth / prune the tree', 'Remove the test set', 'Increase the learning rate'], answer: 1,
    explanation: 'This is overfitting; constraining depth or pruning reduces variance.', source: 'Neural Networks Slides.pptx • Slide 34' },
  { id: 'q8', subjectId: 'ds', concept: 'linear-regression', difficulty: 'Medium', type: 'mcq',
    prompt: 'Ordinary linear regression fits its weights by minimising…', options: ['Cross-entropy', 'Mean squared error', 'Hinge loss', 'Gini impurity'], answer: 1,
    explanation: 'Least squares minimises the mean squared error.', source: 'Machine Learning.pdf • p. 55' },
  { id: 'q9', subjectId: 'ds', concept: 'linear-regression', difficulty: 'Hard', type: 'numeric',
    prompt: 'A model y = 3x + 2 predicts for x = 4. What is ŷ?', answer: '14',
    explanation: '3 × 4 + 2 = 14.', source: 'Machine Learning.pdf • p. 56' },
  { id: 'q10', subjectId: 'ds', concept: 'metrics', difficulty: 'Medium', type: 'numeric',
    prompt: 'TP = 40, FP = 10. What is precision? (give a decimal, e.g. 0.75)', answer: '0.8',
    explanation: 'Precision = 40 / (40 + 10) = 0.8.', source: 'Lecture 5 - Evaluation.mp4 • 02:40' },
  { id: 'q11', subjectId: 'ds', concept: 'metrics', difficulty: 'Medium', type: 'mcq',
    prompt: 'For cancer screening, missing a real positive is very costly. Which metric matters most?', options: ['Precision', 'Recall', 'Accuracy', 'R²'], answer: 1,
    explanation: 'Recall measures how many real positives you catch.', source: 'Lecture 5 - Evaluation.mp4 • 02:40' },
  { id: 'q12', subjectId: 'ds', concept: 'overfitting', difficulty: 'Medium', type: 'mcq',
    prompt: 'Training loss keeps falling while validation loss rises. This indicates…', options: ['Underfitting', 'Overfitting', 'A perfect model', 'Data leakage is impossible'], answer: 1,
    explanation: 'Diverging training and validation loss is the classic sign of overfitting.', source: 'Lecture 5 - Evaluation.mp4 • 13:05' },
  { id: 'q13', subjectId: 'ds', concept: 'cross-validation', difficulty: 'Medium', type: 'numeric',
    prompt: 'In 5-fold cross-validation, how many times is the model trained?', answer: '5',
    explanation: 'Once per fold — 5 times.', source: 'Machine Learning.pdf • p. 70' },
  { id: 'q14', subjectId: 'ds', concept: 'confusion-matrix', difficulty: 'Easy', type: 'mcq',
    prompt: 'A false positive is…', options: ['Predicted negative, actually positive', 'Predicted positive, actually negative', 'Predicted positive, actually positive', 'Predicted negative, actually negative'], answer: 1,
    explanation: 'False positive: the model said positive, the truth was negative.', source: 'Neural Networks Slides.pptx • Slide 43' },
  { id: 'q15', subjectId: 'ds', concept: 'supervised', difficulty: 'Easy', type: 'mcq',
    prompt: 'Which task is unsupervised?', options: ['Predicting house prices', 'Grouping customers with no labels', 'Detecting spam from labelled emails', 'Classifying digits'], answer: 1,
    explanation: 'Clustering unlabelled customers is unsupervised learning.', source: 'Lecture 1 - Intro.mp4 • 14:32' },
  { id: 'q16', subjectId: 'ds', concept: 'missing-values', difficulty: 'Easy', type: 'mcq',
    prompt: 'Which is a robust way to impute a skewed numeric column?', options: ['Mean', 'Median', 'Max', 'Random value'], answer: 1,
    explanation: 'The median is not pulled by outliers in skewed data.', source: 'Machine Learning.pdf • p. 24' },
  { id: 'q17', subjectId: 'ds', concept: 'feature-scaling', difficulty: 'Medium', type: 'numeric',
    prompt: 'Min-max scale x = 30 when min = 10 and max = 50.', answer: '0.5',
    explanation: '(30 − 10) / (50 − 10) = 0.5.', source: 'Neural Networks Slides.pptx • Slide 17' },
  { id: 'q18', subjectId: 'ds', concept: 'correlation', difficulty: 'Easy', type: 'mcq',
    prompt: 'A Pearson correlation of −0.9 means…', options: ['No relationship', 'Strong negative linear relationship', 'Weak positive relationship', 'Causation'], answer: 1,
    explanation: 'Values near −1 indicate a strong negative linear association.', source: 'Machine Learning.pdf • p. 41' },
  { id: 'q19', subjectId: 'math', concept: 'bayes', difficulty: 'Medium', type: 'mcq',
    prompt: "Bayes' theorem relates P(A|B) to…", options: ['P(B|A)·P(A) / P(B)', 'P(A) + P(B)', 'P(A)·P(B)', '1 − P(A)'], answer: 0,
    explanation: 'P(A|B) = P(B|A)P(A)/P(B).', source: 'Probability.pdf • p. 40' },
  { id: 'q20', subjectId: 'math', concept: 'matrices', difficulty: 'Easy', type: 'numeric',
    prompt: 'A 3×2 matrix times a 2×4 matrix gives a matrix with how many columns?', answer: '4',
    explanation: 'The result is 3×4.', source: 'Linear Algebra.pdf • p. 14' },
  { id: 'q21', subjectId: 'math', concept: 'derivatives', difficulty: 'Easy', type: 'numeric',
    prompt: 'What is d/dx of x² at x = 3?', answer: '6',
    explanation: 'd/dx x² = 2x = 6.', source: 'Math Lecture 5.mp4 • 03:30' },
  { id: 'q22', subjectId: 'math', concept: 'probability', difficulty: 'Easy', type: 'numeric',
    prompt: 'Probability of rolling a 6 on a fair die? (decimal to 2 places)', answer: '0.17',
    explanation: '1/6 ≈ 0.17.', source: 'Math Lecture 3.mp4 • 05:00' },
  { id: 'q23', subjectId: 'python', concept: 'py-collections', difficulty: 'Easy', type: 'mcq',
    prompt: 'Which Python type is immutable?', options: ['list', 'dict', 'tuple', 'set'], answer: 2,
    explanation: 'Tuples cannot be modified after creation.', source: 'Python Slides.pptx • Slide 4' },
  { id: 'q24', subjectId: 'python', concept: 'py-basics', difficulty: 'Easy', type: 'numeric',
    prompt: 'What does len([1, 2, 3, 4]) return?', answer: '4',
    explanation: 'The list has four elements.', source: 'Python Lecture 1.mp4 • 06:00' },
  { id: 'q25', subjectId: 'python', concept: 'numpy', difficulty: 'Medium', type: 'mcq',
    prompt: 'np.zeros((2, 3)).shape is…', options: ['(3, 2)', '(2, 3)', '6', '(6,)'], answer: 1,
    explanation: 'The shape tuple you pass is the shape you get.', source: 'Python Lecture 6.mp4 • 04:10' },
  { id: 'q26', subjectId: 'python', concept: 'pandas', difficulty: 'Medium', type: 'mcq',
    prompt: 'Which pandas method returns the first 5 rows?', options: ['df.top()', 'df.head()', 'df.first()', 'df.start()'], answer: 1,
    explanation: 'df.head() defaults to 5 rows.', source: 'Notes - Pandas' },
  { id: 'q27', subjectId: 'web', concept: 'css-layout', difficulty: 'Easy', type: 'mcq',
    prompt: 'Which CSS property turns an element into a flex container?', options: ['position: flex', 'display: flex', 'flex: 1', 'layout: flex'], answer: 1,
    explanation: 'display: flex creates a flex formatting context.', source: 'Web Slides.pptx • Slide 5' },
  { id: 'q28', subjectId: 'web', concept: 'async', difficulty: 'Medium', type: 'mcq',
    prompt: 'fetch() returns…', options: ['A string', 'A Promise', 'An array', 'undefined'], answer: 1,
    explanation: 'fetch is asynchronous and returns a Promise of a Response.', source: 'JS Guide.pdf • p. 62' },
  { id: 'q29', subjectId: 'web', concept: 'dom', difficulty: 'Easy', type: 'mcq',
    prompt: 'document.querySelector returns…', options: ['All matches', 'The first matching element', 'A CSS rule', 'A Promise'], answer: 1,
    explanation: 'querySelector returns the first match (or null).', source: 'Web Lecture 3.mp4 • 04:00' },
  { id: 'q30', subjectId: 'cn', concept: 'osi', difficulty: 'Easy', type: 'numeric',
    prompt: 'How many layers does the OSI model have?', answer: '7',
    explanation: 'Physical, Data Link, Network, Transport, Session, Presentation, Application.', source: 'CN Lecture 1.mp4 • 00:50' },
  { id: 'q31', subjectId: 'cn', concept: 'tcp', difficulty: 'Easy', type: 'mcq',
    prompt: 'Which protocol guarantees ordered, reliable delivery?', options: ['UDP', 'TCP', 'IP', 'ICMP'], answer: 1,
    explanation: 'TCP provides reliability and ordering.', source: 'Networks.pdf • p. 22' },
  { id: 'q32', subjectId: 'cn', concept: 'routing', difficulty: 'Medium', type: 'mcq',
    prompt: 'Dijkstra’s algorithm is used by which routing protocol family?', options: ['Distance vector', 'Link state', 'Path vector', 'Flooding only'], answer: 1,
    explanation: 'Link-state protocols such as OSPF run Dijkstra’s shortest path.', source: 'CN Lecture 4.mp4 • 06:00' },
];

export const suggestedQuestionPool = [
  { q: 'Explain the concept of backpropagation with diagram', from: 'from my slides', theme: 'blue' as Theme },
  { q: 'Summarize Chapter 3 in simple notes', from: 'from my textbook', theme: 'yellow' as Theme },
  { q: 'Create a mind map for neural networks', from: 'with source links', theme: 'pink' as Theme },
  { q: 'Generate important practice questions', from: 'for my upcoming test', theme: 'green' as Theme },
  { q: 'What is the difference between classification and regression?', from: 'from my lectures', theme: 'purple' as Theme },
  { q: 'How does gradient descent choose a learning rate?', from: 'from my textbook', theme: 'blue' as Theme },
  { q: 'Explain max pooling in CNNs', from: 'from my images', theme: 'yellow' as Theme },
  { q: 'How do I prevent overfitting?', from: 'from my lectures', theme: 'pink' as Theme },
  { q: 'What does precision vs recall mean?', from: 'from my lectures', theme: 'green' as Theme },
  { q: 'How do decision trees pick a split?', from: 'from my slides', theme: 'purple' as Theme },
];

export const notesBaseCount = 62; // notes created in earlier terms (not shown in the list)
export const quizzesBase = 0;
