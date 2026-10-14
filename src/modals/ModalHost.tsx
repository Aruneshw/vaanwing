import { useStore } from '../store';
import LessonViewer from './LessonViewer';
import QuizModal from './QuizModal';
import ToolModal from './ToolModal';
import IntakeModal from './IntakeModal';
import { EvalReportModal } from '../components/EvalCard';
import { AddSourceModal, CitationModal, ResourceModal } from './SourceModals';
import {
  ActivityModal,
  AddSubjectModal,
  DemoModal,
  FlowMapModal,
  ManageSubjectsModal,
  NotesModal,
  PathModal,
  ProgressModal,
  QuizHistoryModal,
  SettingsModal,
  WeakModal,
  WeekModal,
} from './MiscModals';

export default function ModalHost() {
  const { modal } = useStore();
  if (!modal) return null;
  switch (modal.type) {
    case 'lesson':
      return <LessonViewer subjectId={modal.subjectId} lessonId={modal.lessonId} />;
    case 'quiz':
      return <QuizModal key={JSON.stringify(modal)} {...modal} />;
    case 'tool':
      return <ToolModal key={modal.tool} tool={modal.tool} />;
    case 'notes':
      return <NotesModal subjectId={modal.subjectId} />;
    case 'activity':
      return <ActivityModal />;
    case 'week':
      return <WeekModal />;
    case 'demo':
      return <DemoModal />;
    case 'manageSubjects':
      return <ManageSubjectsModal />;
    case 'addSubject':
      return <AddSubjectModal />;
    case 'weak':
      return <WeakModal />;
    case 'quizHistory':
      return <QuizHistoryModal />;
    case 'citation':
      return <CitationModal key={modal.chunkId} chunkId={modal.chunkId} />;
    case 'resource':
      return <ResourceModal resourceId={modal.resourceId} />;
    case 'addSource':
      return <AddSourceModal key={modal.kind ?? 'all'} kind={modal.kind} />;
    case 'settings':
      return <SettingsModal />;
    case 'flowmap':
      return <FlowMapModal subjectId={modal.subjectId} />;
    case 'progress':
      return <ProgressModal />;
    case 'path':
      return <PathModal />;
    case 'intake':
      return <IntakeModal />;
    case 'evalReport':
      return <EvalReportModal />;
  }
}
