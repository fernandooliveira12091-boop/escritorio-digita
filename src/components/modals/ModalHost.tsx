import { useUi } from "../../store/ui";
import { ContactModal, ProcessModal, TransactionModal } from "./OtherModals";
import { TaskDetail } from "./TaskDetail";
import { TaskModal } from "./TaskModal";

export function ModalHost() {
  const modal = useUi((s) => s.modal);
  if (!modal) return null;
  switch (modal.kind) {
    case "task":
      return <TaskModal key={modal.task?.id ?? "new"} task={modal.task} preset={modal.preset} />;
    case "taskDetail":
      return <TaskDetail taskId={modal.taskId} />;
    case "contact":
      return <ContactModal id={modal.id} />;
    case "process":
      return <ProcessModal id={modal.id} preset={modal.preset} />;
    case "transaction":
      return <TransactionModal id={modal.id} txKind={modal.txKind} />;
  }
}
