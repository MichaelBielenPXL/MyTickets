import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'

import { t } from '@/lib/i18n'

type SortableListProps<T extends { id: string }> = {
  items: T[]
  /** Called with every id in the new order after something is dropped somewhere else. */
  onReorder: (ids: string[]) => void
  /** What a row is called on its drag handle, for screen readers: "Move Beer". */
  nameOf: (item: T) => string
  renderItem: (item: T, handle: ReactNode) => ReactNode
  disabled?: boolean
}

/**
 * A list people put in their own order by dragging the handle on each row. Works with a mouse, on a
 * touch screen (press and hold briefly, so scrolling still works), and with the keyboard (space, arrows, space).
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  nameOf,
  renderItem,
  disabled,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function drop({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const ids = items.map((item) => item.id)
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={drop}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className="list">
          {items.map((item) => (
            <SortableRow key={item.id} id={item.id} name={nameOf(item)} disabled={disabled}>
              {(handle) => renderItem(item, handle)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

type SortableRowProps = {
  id: string
  name: string
  disabled?: boolean
  children: (handle: ReactNode) => ReactNode
}

function SortableRow({ id, name, disabled, children }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({
      id,
      disabled,
    })
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className="drag-handle"
      aria-label={t('Move {name}', { name })}
      {...attributes}
      {...listeners}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        {[3, 8, 13].map((y) =>
          [5.5, 10.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill="currentColor" />),
        )}
      </svg>
    </button>
  )
  return (
    <div
      ref={setNodeRef}
      className={isDragging ? 'sortable-row dragging' : 'sortable-row'}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {children(handle)}
    </div>
  )
}
