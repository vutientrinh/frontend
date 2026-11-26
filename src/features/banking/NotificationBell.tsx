import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { Bell, X } from "lucide-react";
import {
  useMarkNotificationsRead,
  useNotifications,
  useUnreadCount,
} from "../commerce/api";

function badgeText(count: number) {
  return count > 9 ? "9+" : String(count);
}

function bellLabel(count: number) {
  return count > 0 ? `Notifications, ${count} unread` : "Notifications";
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute right-0 top-0 min-w-5 rounded-full bg-primary px-1 text-center text-xs text-primary-foreground"
    >
      {badgeText(count)}
    </span>
  );
}

const bellClass =
  "relative grid size-11 shrink-0 place-items-center rounded-md hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";

/** Desktop bell: toggles the popover. */
export const BellButton = forwardRef<
  HTMLButtonElement,
  { expanded: boolean; active: boolean; onClick: () => void }
>(function BellButton({ expanded, active, onClick }, ref) {
  const unread = useUnreadCount();
  const count = unread.data?.count ?? 0;
  return (
    <button
      ref={ref}
      type="button"
      aria-label={bellLabel(count)}
      aria-expanded={expanded}
      aria-controls="shopper-notifications-popover"
      onClick={onClick}
      className={`${bellClass} ${active ? "text-primary" : ""}`}
    >
      <Bell size={19} aria-hidden="true" />
      <Badge count={count} />
    </button>
  );
});

/** Mobile bell: goes straight to the notifications page (no popover). */
export function BellLink({ active }: { active: boolean }) {
  const unread = useUnreadCount();
  const count = unread.data?.count ?? 0;
  return (
    <Link
      to="/notifications"
      aria-label={bellLabel(count)}
      aria-current={active ? "page" : undefined}
      className={`${bellClass} ml-auto ${active ? "text-primary" : ""}`}
    >
      <Bell size={19} aria-hidden="true" />
      <Badge count={count} />
    </Link>
  );
}

function timeAgo(iso: string) {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - Date.parse(iso)) / 60000),
  );
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const list = useNotifications({ size: 5 });
  const unread = useUnreadCount();
  const markRead = useMarkNotificationsRead();
  const items = list.data?.content ?? [];
  const unreadCount = unread.data?.count ?? 0;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Notifications</h2>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              type="button"
              disabled={markRead.isPending}
              onClick={() => markRead.mutate({ all: true })}
              className="min-h-9 rounded px-2 text-sm font-medium text-primary hover:bg-muted"
            >
              Mark all read
            </button>
          )}
          <button
            type="button"
            aria-label="Close notifications"
            onClick={onClose}
            className="grid size-9 place-items-center rounded hover:bg-muted"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
      {list.isPending ? (
        <div role="status" aria-label="Loading notifications" className="mt-3">
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="my-2 h-10 animate-pulse rounded bg-muted"
            />
          ))}
        </div>
      ) : list.isError ? (
        <div className="mt-3 text-sm">
          <p className="text-muted-foreground">Couldn’t load notifications.</p>
          <button
            type="button"
            onClick={() => void list.refetch()}
            className="mt-1 min-h-11 text-sm font-medium text-primary"
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          You’re all caught up.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={item.href}
                onClick={() => {
                  if (!item.readAt) markRead.mutate({ ids: [item.id] });
                  onClose();
                }}
                className="flex min-h-11 items-start gap-2 rounded py-2 text-sm hover:bg-muted"
              >
                <span
                  aria-hidden="true"
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${item.readAt ? "bg-transparent" : "bg-primary"}`}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate ${item.readAt ? "" : "font-medium"}`}
                  >
                    {!item.readAt && <span className="sr-only">Unread: </span>}
                    {item.title}
                  </span>
                  <span className="block truncate text-muted-foreground">
                    {item.body}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {timeAgo(item.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/notifications"
        onClick={onClose}
        className="mt-2 inline-block min-h-11 py-3 text-sm font-medium text-primary"
      >
        See all notifications
      </Link>
    </div>
  );
}
