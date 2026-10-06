"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { formatDateTime } from "@/components/stats/format";
import { Button } from "@/components/ui/Button";
import { ErrorText, TextInput } from "@/components/ui/TextInput";
import { accountNameOf } from "@/lib/cloud/account";
import type { CloudStatus } from "@/lib/cloud/CloudSyncService";
import { errorMessage, type MessageKey } from "@/lib/i18n";

/** Owner Settings → cloud sync: log in with the family account name + password. */
export function CloudSyncPanel() {
  const { t, services, settings } = useApp();
  const cloud = services.cloud;
  const [status, setStatus] = useState<CloudStatus>(() => cloud.getStatus());
  const [accountName, setAccountName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => cloud.subscribe(setStatus), [cloud]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  async function run(action: () => Promise<unknown>, done?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      if (done) setNotice(done);
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent, mode: "signIn" | "signUp") {
    event.preventDefault();
    void run(async () => {
      if (mode === "signIn") await cloud.signIn(accountName, password);
      else await cloud.signUp(accountName, password);
      setPassword("");
    });
  }

  if (status.state === "loading") {
    return (
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">{t("cloud.title")}</h3>
        <p className="text-sm text-muted">{t("cloud.loading")}</p>
      </section>
    );
  }

  if (status.state === "signedOut") {
    const ready = accountName.trim().length >= 3 && password.length >= 6 && !busy;
    return (
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t("cloud.title")}</h3>
        <p className="text-sm text-muted">{t("cloud.intro")}</p>
        {notice && (
          <p role="status" className="rounded-control bg-surface-muted p-2 text-sm text-success">
            {notice}
          </p>
        )}
        <form onSubmit={(e) => submit(e, "signIn")} className="space-y-2">
          <label className="block space-y-1">
            <span className="text-sm text-foreground">{t("cloud.accountName")}</span>
            <TextInput
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={30}
            />
            <span className="block text-xs text-muted">{t("cloud.accountNameHint")}</span>
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-foreground">{t("cloud.password")}</span>
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <span className="block text-xs text-muted">{t("cloud.passwordHint")}</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!ready}>
              {t("cloud.signIn")}
            </Button>
            <Button variant="secondary" disabled={!ready} onClick={(e) => submit(e, "signUp")}>
              {t("cloud.signUp")}
            </Button>
          </div>
          <ErrorText>{error}</ErrorText>
        </form>
        <p className="text-xs text-muted">{t("cloud.signUpNote")}</p>
        <p className="text-xs text-muted">{t("cloud.forgotNote")}</p>
      </section>
    );
  }

  const syncText = status.syncing
    ? t("cloud.syncing")
    : status.lastSyncedAt
      ? t("cloud.lastSynced", { time: formatDateTime(status.lastSyncedAt, settings.locale) })
      : t("cloud.neverSynced");
  const syncError = status.error ? t(`error.${status.error}` as MessageKey) : null;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{t("cloud.title")}</h3>
      <p className="text-sm font-medium text-foreground">{t("cloud.signedInAs", { name: accountNameOf(status.user.email) })}</p>
      <p role="status" className="text-sm text-muted">
        {syncText}
      </p>
      {!online && <p className="text-sm text-muted">{t("cloud.offline")}</p>}
      {notice && !status.syncing && <p className="text-sm text-success">{notice}</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || status.syncing}
          onClick={() =>
            run(async () => {
              // A failed sync shows its reason via status.error below.
              if (await cloud.syncNow()) setNotice(t("cloud.syncDone"));
            })
          }
        >
          {t("cloud.syncNow")}
        </Button>
        {!confirmSignOut ? (
          <Button variant="dangerGhost" disabled={busy} onClick={() => setConfirmSignOut(true)}>
            {t("cloud.signOut")}
          </Button>
        ) : null}
      </div>
      {confirmSignOut && (
        <div className="space-y-2 rounded-control border border-border p-2">
          <p className="text-sm text-foreground">{t("cloud.signOutConfirm")}</p>
          <div className="flex gap-2">
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await cloud.signOut();
                  setConfirmSignOut(false);
                }, t("cloud.signedOut"))
              }
            >
              {t("cloud.signOutYes")}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmSignOut(false)}>
              {t("owner.cancel")}
            </Button>
          </div>
        </div>
      )}
      <ErrorText>{syncError ?? error}</ErrorText>
      <p className="text-xs text-muted">{t("cloud.autoNote")}</p>
    </section>
  );
}
