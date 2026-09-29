"use client";

import { Bell } from "lucide-react";
import { useEffect, useState } from "react";

import { getPushConfigurationAction, subscribeAdminPushAction, testAdminPushAction, unsubscribeAdminPushAction } from "@/app/push-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

function applicationKey(value: string) {
  const decoded = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

type Readiness = "loading" | "ready" | "install" | "unsupported" | "unconfigured" | "error";

export function PushNotifications() {
  const [open, setOpen] = useState(false);
  const [readiness, setReadiness] = useState<Readiness>("loading");
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [publicKey, setPublicKey] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function prepare() {
      setReadiness("loading");
      setError("");
      setFeedback("");
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const standalone = window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone;
      if (ios && !standalone) {
        setReadiness("install");
        return;
      }
      if (!window.isSecureContext || !("serviceWorker" in navigator) ||
        !("PushManager" in window) || !("Notification" in window)) {
        setReadiness("unsupported");
        return;
      }
      setBlocked(Notification.permission === "denied");
      try {
        const config = await getPushConfigurationAction();
        if (!config.ok) throw new Error(config.error);
        if (cancelled) return;
        if (!config.data.publicKey) {
          setReadiness("unconfigured");
          return;
        }
        await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        const ready = await navigator.serviceWorker.ready;
        const current = await ready.pushManager.getSubscription();
        if (cancelled) return;
        if (current) {
          // Reconcilia a inscrição com o servidor ao reabrir as preferências.
          const saved = await subscribeAdminPushAction(current.toJSON());
          if (!saved.ok) throw new Error(saved.error);
        }
        if (cancelled) return;
        setPublicKey(config.data.publicKey);
        setRegistration(ready);
        setSubscription(current);
        setReadiness("ready");
      } catch (failure) {
        if (!cancelled) {
          setReadiness("error");
          setError(failure instanceof Error ? failure.message : "Não foi possível preparar as notificações.");
        }
      }
    }

    void prepare();
    return () => { cancelled = true; };
  }, [open, attempt]);

  async function enable() {
    if (!registration || !publicKey) return;
    setBusy(true);
    setError("");
    setFeedback("");
    let created: PushSubscription | null = null;
    try {
      // Chamada direta do clique: preserva o gesto exigido pelo iOS para pedir permissão.
      created = await registration.pushManager.subscribe({
        userVisibleOnly: true, applicationServerKey: applicationKey(publicKey),
      });
      const result = await subscribeAdminPushAction(created.toJSON());
      if (!result.ok) throw new Error(result.error);
      setSubscription(created);
      setFeedback("Notificações ativadas neste dispositivo.");
    } catch (failure) {
      if (created) await created.unsubscribe().catch(() => false);
      setBlocked(Notification.permission === "denied");
      setError(failure instanceof Error && failure.name !== "NotAllowedError"
        ? failure.message : "A permissão não foi concedida. Verifique os ajustes de notificações.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!subscription) return;
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      const result = await unsubscribeAdminPushAction(subscription.endpoint);
      if (!result.ok) throw new Error(result.error);
      await subscription.unsubscribe();
      setSubscription(null);
      setFeedback("Notificações desativadas neste dispositivo.");
    } catch {
      setError("Não foi possível concluir a desativação. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    if (!subscription) return;
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      const result = await testAdminPushAction(subscription.endpoint);
      if (!result.ok) throw new Error(result.error);
      setFeedback("Teste enviado. Confira as notificações do aparelho; o modo Foco pode silenciar o aviso.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível enviar o teste.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Notificações de agendamentos" onClick={() => setOpen(true)}>
        <Bell className="size-5" aria-hidden="true" />
      </Button>
      <Modal open={open} title="Notificações de agendamentos" onClose={() => { if (!busy) setOpen(false); }}
        description="Receba um aviso neste dispositivo quando uma cliente agendar pelo portal.">
        <div className="space-y-4 p-5 sm:p-6">
          {readiness === "loading" && <p role="status">Preparando notificações…</p>}
          {readiness === "install" && <div className="space-y-3 text-sm">
            <p>No iPhone ou iPad, é necessário iOS/iPadOS 16.4 ou posterior.</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>Abra este site no Safari e toque em Compartilhar.</li>
              <li>Escolha Adicionar à Tela de Início e abra o Nail Agenda pelo novo ícone.</li>
              <li>Entre como administrador, toque no sino e ative as notificações.</li>
            </ol>
          </div>}
          {readiness === "unsupported" && <p className="text-sm">Este navegador não oferece notificações aqui. Use o site com HTTPS em um navegador atualizado. No Android, abra no Chrome; no iPhone, use o aplicativo adicionado à Tela de Início.</p>}
          {readiness === "unconfigured" && <p className="text-sm">As notificações ainda não estão disponíveis. A configuração do envio precisa ser concluída pelo responsável pelo sistema.</p>}
          {readiness === "ready" && <>
            <p className="text-sm">{subscription ? "Este dispositivo está cadastrado para receber avisos." : "Ative para receber avisos mesmo quando o painel estiver fechado."}</p>
            {blocked && <p className="text-sm">As notificações estão bloqueadas. Permita os avisos nos ajustes do navegador ou, no iPhone, em Ajustes → Notificações → Nail Agenda. Depois, reabra esta janela.</p>}
            <div className="flex flex-wrap gap-2">
              {subscription ? <>
                <Button loading={busy} disabled={blocked} onClick={() => void test()}>Enviar teste</Button>
                <Button variant="secondary" disabled={busy} onClick={() => void disable()}>Desativar neste dispositivo</Button>
              </> : <Button loading={busy} disabled={blocked} onClick={() => void enable()}>Ativar notificações</Button>}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Ative somente nos seus dispositivos. Os avisos continuam após sair da conta, até serem desativados aqui ou nos ajustes do aparelho. Os detalhes do agendamento exigem login.</p>
          </>}
          {error && <Alert tone="error">{error}</Alert>}
          {feedback && <Alert tone="success">{feedback}</Alert>}
          {readiness === "error" && <Button variant="secondary" onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</Button>}
        </div>
      </Modal>
    </>
  );
}
