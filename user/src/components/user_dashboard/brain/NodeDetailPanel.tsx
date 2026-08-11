"use client";

import { useState } from "react";
import {
  ArchiveRestore, ArrowLeft, ArrowRight, Building2, ExternalLink, Pencil, Plus, X, Archive,
  Sparkles, Loader2, Lock, LockOpen,
} from "lucide-react";
import { useLanguage } from "@/hooks/context/LanguageContext";
import {
  BrainNodeDetail, LinkedNode, archiveBrainNode, disconnectBrainNodes, unarchiveBrainNode,
  enrichBrainNode, setNodeRestriction,
} from "@/lib/api/brain";
import EntityRefCard from "./EntityRefCard";

/**
 * A single node, opened.
 *
 * Shows its body, everything it points at, and — the part that makes the Brain
 * a graph rather than a folder — everything that points back at it. Backlinks
 * are how a user discovers that a note they wrote months ago is relevant to
 * what they're looking at now.
 */
export default function NodeDetailPanel({
  isDark, node, canRestrict = false, onClose, onEdit, onAddConnected, onChanged,
}: {
  isDark: boolean;
  node: BrainNodeDetail;
  /** Owner or admin — only they can restrict a node (spec §10). */
  canRestrict?: boolean;
  onClose: () => void;
  onEdit: () => void;
  onAddConnected: () => void;
  onChanged: () => void;
  onOpenNode?: (id: string) => void;
}) {
  const { t } = useLanguage();
  const [finding, setFinding] = useState(false);
  /** What the last run actually did. Without this, "too short", "cap reached"
   *  and "worked fine" are indistinguishable — the run just appears to do
   *  nothing, which reads as broken. */
  const [outcome, setOutcome] = useState<string | null>(null);

  const restricted = node.accessOverride === "owners_admins";

  const findRelated = async () => {
    setFinding(true);
    setOutcome(null);
    try {
      const result = await enrichBrainNode(node.id);
      // Report the summary decision first — it's the one that costs money and
      // the one people are waiting on. Linking is reported when nothing else
      // happened, so a run is never silent.
      if (result.summarized) setOutcome(t("dashboard", "brainEnrich_summarized"));
      else if (result.skipped) setOutcome(t("dashboard", `brainEnrich_${result.skipped}`));
      else if (result.linked > 0) setOutcome(`${result.linked} ${t("dashboard", "brainEnrich_linked")}`);
      else setOutcome(t("dashboard", "brainEnrich_none"));
    } catch (e) {
      setOutcome(e instanceof Error ? e.message : t("dashboard", "brainEnrich_none"));
    } finally {
      setFinding(false);
      onChanged();
    }
  };

  const toggleRestriction = async () => {
    try {
      await setNodeRestriction(node.id, restricted ? null : "owners_admins");
    } finally {
      onChanged();
    }
  };

  const card = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const border = isDark ? "border-gray-700" : "border-gray-200";

  const url = typeof node.payload?.url === "string" ? node.payload.url : null;
  const taskStatus = typeof node.payload?.status === "string" ? node.payload.status : null;
  const dueDate = typeof node.payload?.dueDate === "string" ? node.payload.dueDate : null;

  const isArchived = node.status === "archived";

  /**
   * Archive and unarchive are the same call with a different status, so one
   * handler covers both. Archiving keeps every connection — that's the whole
   * difference from deleting, and why it needs no scary confirmation.
   */
  const toggleArchive = async () => {
    try {
      if (isArchived) await unarchiveBrainNode(node.id);
      else await archiveBrainNode(node.id);
    } finally {
      onChanged();
    }
  };

  const unlink = async (edgeId: string) => {
    if (!window.confirm(t("dashboard", "brainConfirmUnlink"))) return;
    try {
      await disconnectBrainNodes(edgeId);
      onChanged();
    } catch {
      /* The panel refreshes from the server either way; a failed unlink just
         leaves the link in place, which is the safe outcome. */
      onChanged();
    }
  };

  const LinkRow = ({ link, removable }: { link: LinkedNode; removable: boolean }) => (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${border}`}>
      {link.type === "category" && <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />}
      <span className={`flex-1 truncate ${text}`}>{link.title}</span>
      {/* A link generated from a [[wiki link]] is owned by the note's text —
          removing it here would be undone the next time the note is saved. */}
      {/* Three provenances, three labels. A suggested link is removable like a
          manual one — and removing it records a dismissal server-side so the
          next save doesn't put it straight back. */}
      <span className={`text-[11px] ${link.createdBy === "ai_suggested" ? "text-blue-500" : sub}`}>
        {link.createdBy === "system"
          ? t("dashboard", "brainLinkFromText")
          : link.createdBy === "ai_suggested"
            ? t("dashboard", "brainLinkSuggested")
            : t("dashboard", "brainLinkManual")}
      </span>
      {removable && link.createdBy !== "system" && (
        <button onClick={() => unlink(link.edgeId)} className={`${sub} hover:text-red-500`} title={t("dashboard", "brainUnlink")}>
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <div className={`rounded-xl border ${card}`}>
      <div className={`flex items-start gap-3 px-5 py-4 border-b ${border}`}>
        <div className="flex-1 min-w-0">
          <p className={`text-[11px] uppercase tracking-wide ${sub}`}>
            {node.type === "entity_ref"
              ? t("dashboard", "brainTypeRecord")
              : t("dashboard", `brainType${node.type.charAt(0).toUpperCase()}${node.type.slice(1)}`)}
            {node.categoryName ? ` · ${node.categoryName}` : ` · ${t("dashboard", "brainUnassigned")}`}
          </p>
          <h2 className={`text-lg font-bold mt-0.5 break-words ${text}`}>{node.title}</h2>
          <div className="flex items-center gap-1.5 flex-wrap">
            {isArchived && (
              <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-500">
                <Archive className="h-3 w-3" />{t("dashboard", "brainArchivedBadge")}
              </span>
            )}
            {restricted && (
              <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/15 text-purple-500">
                <Lock className="h-3 w-3" />{t("dashboard", "brainRestricted")}
              </span>
            )}
          </div>
        </div>
        <button onClick={toggleArchive} className={`${sub} hover:text-amber-500`}
          title={t("dashboard", isArchived ? "brainUnarchive" : "brainArchive")}>
          {isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
        </button>
        <button onClick={onEdit} className={`${sub} hover:text-blue-500`} title={t("dashboard", "brainEditNode")}>
          <Pencil className="h-4 w-4" />
        </button>
        <button onClick={onClose} className={sub} aria-label={t("dashboard", "brainCloseNode")}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-5 py-4 space-y-4">
        {taskStatus && (
          <div className="flex items-center gap-3 text-sm">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              taskStatus === "done" ? "bg-green-500/15 text-green-500"
                : taskStatus === "in_progress" ? "bg-amber-500/15 text-amber-500"
                : "bg-gray-500/15 text-gray-400"
            }`}>
              {t("dashboard", taskStatus === "done" ? "brainTaskDone" : taskStatus === "in_progress" ? "brainTaskInProgress" : "brainTaskOpen")}
            </span>
            {dueDate && <span className={sub}>{t("dashboard", "brainTaskDue")}: {dueDate}</span>}
          </div>
        )}

        {/* The referenced record, read live. Sits above the body so the
            numbers and the reasoning about them read as one thing. */}
        {node.entity && <EntityRefCard isDark={isDark} entity={node.entity} />}

        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-blue-500 hover:underline break-all">
            <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />{url}
          </a>
        )}

        {/* The AI summary, when one exists. Above the body because its whole
            job is telling you whether you need to read the body. */}
        {node.summary && (
          <div className={`rounded-lg border-l-2 border-amber-500 pl-3 py-1`}>
            <p className={`text-[11px] uppercase tracking-wide ${sub}`}>{t("dashboard", "brainSummaryLabel")}</p>
            <p className={`text-sm ${text}`}>{node.summary}</p>
          </div>
        )}

        {node.content ? (
          <p className={`text-sm whitespace-pre-wrap leading-relaxed ${text}`}>{node.content}</p>
        ) : (
          <p className={`text-sm italic ${sub}`}>{t("dashboard", "brainNoBody")}</p>
        )}

        <div className={`grid sm:grid-cols-2 gap-4 pt-2 border-t ${border}`}>
          <div>
            <p className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-2 mt-3 ${sub}`}>
              <ArrowRight className="h-3.5 w-3.5" />{t("dashboard", "brainLinksTo")}
            </p>
            {node.links.length === 0 ? (
              <p className={`text-sm ${sub}`}>{t("dashboard", "brainNoLinks")}</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {node.links.map((l) => <LinkRow key={l.edgeId} link={l} removable />)}
              </div>
            )}
          </div>

          <div>
            <p className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-2 mt-3 ${sub}`}>
              <ArrowLeft className="h-3.5 w-3.5" />{t("dashboard", "brainBacklinks")}
            </p>
            {node.backlinks.length === 0 ? (
              <p className={`text-sm ${sub}`}>{t("dashboard", "brainNoBacklinks")}</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {node.backlinks.map((l) => <LinkRow key={l.edgeId} link={l} removable={false} />)}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <button onClick={onAddConnected}
            className={`flex items-center gap-1.5 text-sm font-medium text-green-600 hover:text-green-700`}>
            <Plus className="h-4 w-4" />{t("dashboard", "brainAddConnected")}
          </button>

          {/* Runs the same pass the background job runs, without the 8s wait.
              Obeys the same settings and caps, so it's not a way around them. */}
          <button onClick={findRelated} disabled={finding}
            className="flex items-center gap-1.5 text-sm font-medium text-blue-500 hover:text-blue-600 disabled:opacity-60">
            {finding
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Sparkles className="h-4 w-4" />}
            {t("dashboard", "brainFindRelated")}
          </button>

          {canRestrict && (
            <button onClick={toggleRestriction}
              className={`flex items-center gap-1.5 text-sm font-medium ${
                restricted ? "text-amber-500" : `${sub} hover:text-amber-500`
              }`}>
              {restricted ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
              {t("dashboard", restricted ? "brainRestricted" : "brainRestrictNode")}
            </button>
          )}

          {outcome && <span className={`text-xs ${sub}`}>{outcome}</span>}
        </div>
      </div>
    </div>
  );
}
