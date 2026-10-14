// Course structure + verified question bank for the Operating System notes PDF.
// Every question cites the page it was written from. The subject itself (modules,
// lessons, lesson text) is built from the text actually extracted from the uploaded PDF.
import type { Concept, Lesson, Question, Subject } from './data';
import { pageTopic } from './pdf';

export const OS_SUBJECT_ID = 'os';

export const osTopics = [
  'Introduction to Operating Systems', 'Process Management', 'Process Synchronization', 'Memory Management',
  'Virtual Memory', 'Paging', 'Segmentation', 'File Systems', 'I/O and Interrupts', 'Deadlocks', 'CPU Scheduling',
  'Disk Management', 'Disk Scheduling Algorithms', 'Protection and Security', 'Cryptography', 'Data Encryption',
  'Distributed Operating Systems',
];

export const osConceptId = (n: number) => `os-${String(n).padStart(2, '0')}`;

export const osConcepts: Concept[] = osTopics.map((name, i) => ({
  id: osConceptId(i + 1),
  name,
  subjectId: OS_SUBJECT_ID,
  lessonId: `os-l${i + 1}-0`,
  source: `Operating System Notes.pdf • p. ${3 + i * 3}`,
  summary: `Topic ${i + 1} of the Operating System notes.`,
}));

const q = (id: string, topic: number, difficulty: Question['difficulty'], type: Question['type'], prompt: string, answer: number | string, explanation: string, page: number, options?: string[], accept?: string[]): Question => ({
  id, subjectId: OS_SUBJECT_ID, concept: osConceptId(topic), difficulty, type, prompt, answer, explanation, options, accept,
  source: `Operating System Notes.pdf • p. ${page}`,
});

export const osQuestions: Question[] = [
  q('os1', 1, 'Easy', 'mcq', 'An operating system is best described as…', 1, 'The OS is system software that manages hardware resources and provides common services to applications.', 3,
    ['An application that edits documents', 'System software that manages hardware and provides services to applications', 'A hardware component inside the CPU', 'A programming language']),
  q('os2', 1, 'Medium', 'mcq', 'How do applications normally request privileged operations?', 2, 'Applications go through controlled OS interfaces (system calls) instead of touching hardware directly.', 3,
    ['By writing directly to device registers', 'By rebooting the machine', 'Through the system-call interface', 'Through the BIOS only']),
  q('os3', 2, 'Easy', 'mcq', 'Which structure stores a process’s state, program counter and CPU registers?', 0, 'The Process Control Block (PCB) holds process-management information.', 6,
    ['Process Control Block (PCB)', 'Page table', 'Segment table', 'Inode']),
  q('os4', 2, 'Medium', 'mcq', 'A process waiting for an I/O event is in which state?', 3, 'Waiting = waiting for an event such as I/O; Ready = waiting for the CPU.', 8,
    ['New', 'Ready', 'Running', 'Waiting']),
  q('os5', 2, 'Easy', 'short', 'What is the name for saving one process’s execution state and restoring another’s?', 'context switch', 'That is a context switch.', 6, undefined, ['context switch', 'context-switch', 'context switching']),
  q('os6', 3, 'Medium', 'mcq', 'A race condition occurs when…', 1, 'Correctness depends on the relative timing of concurrent accesses to shared data.', 9,
    ['Two processes use different memory', 'The result depends on the timing of concurrent operations', 'The CPU runs too fast', 'A process finishes early']),
  q('os7', 3, 'Medium', 'mcq', 'A semaphore is manipulated through which atomic operations?', 0, 'Semaphores are integers changed only through atomic wait/signal.', 10,
    ['wait and signal', 'read and write', 'fork and exec', 'open and close']),
  q('os8', 4, 'Easy', 'mcq', 'Which of these is NOT a common contiguous allocation strategy?', 3, 'First-fit, best-fit and worst-fit are the common strategies.', 12,
    ['First-fit', 'Best-fit', 'Worst-fit', 'Round-fit']),
  q('os9', 5, 'Medium', 'mcq', 'Too many page faults that leave the CPU doing little useful work is called…', 2, 'Excessive page faults cause thrashing.', 15,
    ['Paging', 'Swapping', 'Thrashing', 'Spooling']),
  q('os10', 6, 'Medium', 'numeric', 'Page size is 4096 bytes. How many offset bits are in an address?', '12', 'Offset bits = log2(page size) = log2(4096) = 12.', 54),
  q('os11', 6, 'Easy', 'mcq', 'What does a TLB do?', 1, 'The TLB caches recent page-table translations to reduce lookup time.', 18,
    ['Stores entire files', 'Caches recent address translations', 'Schedules the CPU', 'Encrypts pages']),
  q('os12', 7, 'Medium', 'numeric', 'Segment base = 1400, limit = 1000, offset = 53. What is the physical address?', '1453', 'Physical address = base + offset (offset < limit) = 1400 + 53 = 1453.', 54),
  q('os13', 8, 'Easy', 'mcq', 'Which is a file allocation method?', 2, 'Contiguous, linked and indexed allocation are the common approaches.', 24,
    ['Round Robin', 'SSTF', 'Indexed allocation', 'Demand paging']),
  q('os14', 9, 'Medium', 'mcq', 'Which mechanism lets a controller move data to memory with little CPU involvement?', 1, 'DMA transfers blocks between device and memory with limited CPU involvement.', 27,
    ['Polling', 'DMA', 'Spooling', 'Context switching']),
  q('os15', 10, 'Medium', 'mcq', 'Which is NOT one of the four necessary conditions for deadlock?', 3, 'The four are mutual exclusion, hold and wait, no preemption and circular wait.', 30,
    ['Mutual exclusion', 'Hold and wait', 'Circular wait', 'Preemption allowed']),
  q('os16', 10, 'Hard', 'mcq', 'The Banker’s algorithm is a classic approach to deadlock…', 1, 'Avoidance needs information about future resource demands — the Banker’s algorithm.', 30,
    ['Detection', 'Avoidance', 'Recovery', 'Prevention by preemption']),
  q('os17', 11, 'Hard', 'numeric', 'FCFS bursts 5, 2, 4 arrive at time 0 in that order. What is the average waiting time?', '4', 'Waits are 0, 5 and 7 → (0 + 5 + 7) / 3 = 4.', 35),
  q('os18', 11, 'Medium', 'mcq', 'Which algorithm can suffer from the convoy effect?', 0, 'FCFS is simple but long jobs at the front create a convoy.', 33,
    ['FCFS', 'Round Robin', 'SJF', 'Priority with aging']),
  q('os19', 12, 'Easy', 'mcq', 'Disk access time does NOT include…', 3, 'It includes seek time, rotational latency and transfer time.', 36,
    ['Seek time', 'Rotational latency', 'Transfer time', 'Time quantum']),
  q('os20', 13, 'Medium', 'mcq', 'Which disk algorithm picks the request with the smallest seek distance (and may starve far requests)?', 1, 'SSTF = Shortest Seek Time First.', 39,
    ['FCFS', 'SSTF', 'SCAN', 'C-SCAN']),
  q('os21', 14, 'Easy', 'mcq', 'Authentication establishes ____; authorization controls ____.', 0, 'Authentication = identity; authorization = permitted actions.', 42,
    ['identity; allowed actions', 'allowed actions; identity', 'encryption; hashing', 'speed; storage']),
  q('os22', 15, 'Medium', 'mcq', 'Asymmetric cryptography uses…', 2, 'A public/private key pair; useful for key exchange and signatures.', 45,
    ['One shared secret key', 'No keys at all', 'A public/private key pair', 'Only hash functions']),
  q('os23', 16, 'Medium', 'mcq', 'How should a system store user passwords?', 1, 'Use salted, slow password hashes — never reversible passwords.', 48,
    ['Encrypted with a reversible key', 'As salted, slow hashes', 'In plain text', 'Base64-encoded']),
  q('os24', 17, 'Easy', 'mcq', 'Which is a challenge specific to distributed systems?', 2, 'Delays, partial failures and no single global clock.', 51,
    ['Having one CPU', 'Too little RAM', 'No single global clock', 'Lack of a file system']),
];

const lessonTitles = ['Core Idea', 'Deep Dive & Terminology', 'Quick Revision'];
const lessonTypes: Lesson['type'][] = ['pdf', 'notes', 'slides'];

/** Detect the OS notes PDF and turn its pages into a Learn-tab course. */
export function buildOsSubject(pages: string[], fileName: string): Subject | null {
  const byTopic = new Map<number, number[]>();
  pages.forEach((p, i) => {
    const m = p.match(/TOPIC (\d{1,2})/);
    if (m) byTopic.set(Number(m[1]), [...(byTopic.get(Number(m[1])) ?? []), i + 1]);
  });
  const matched = osTopics.filter((t) => pages.some((p) => p.includes(t))).length;
  if (byTopic.size < 5 || matched < 8) return null;
  const tidy = (s: string) => s.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    id: OS_SUBJECT_ID,
    name: 'Operating Systems',
    icon: 'network',
    theme: 'pink',
    modules: [...byTopic.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([n, pageNums]) => ({
        id: `os-m${n}`,
        title: pageTopic(pages[pageNums[0] - 1]),
        lessons: pageNums.slice(0, 3).map((pg, k) => ({
          id: `os-l${n}-${k}`,
          title: `${lessonTitles[k] ?? `Part ${k + 1}`}`,
          type: lessonTypes[k] ?? 'pdf',
          meta: `PDF • Page ${pg}`,
          progress: 0,
          concepts: [osConceptId(n)],
          source: `${fileName} • p. ${pg}`,
          content: tidy(pages[pg - 1]).slice(0, 900),
        })),
      })),
  };
}
