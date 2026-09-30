"use client";

import { Check, CircleAlert, Eye, EyeOff, LoaderCircle } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useAnimate,
  useReducedMotion,
} from "motion/react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { FluxLogo } from "@/components/brand/flux-logo";
import { EASE_OUT, MotionProvider } from "@/components/motion-provider";
import { endSession, startSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { checkPassword } from "./fake-auth";
import { SamplePlot } from "./sample-plot";

const FEATURES = [
  { title: "Lokal im Browser", text: "Nichts wird hochgeladen." },
  { title: "15-Minuten-Werte", text: "SDAT und ESL kombiniert." },
  { title: "CSV, JSON oder API", text: "Sauber exportiert." },
];

// the form is centred by its height without the error row, so the error only pushes the button down
const FORM_HEIGHT = 206;

export function LoginScreen() {
  return (
    <MotionProvider>
      <main className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,696px)_minmax(420px,1fr)]">
        <BrandPanel />
        <section className="flex flex-col items-center justify-center px-6 py-16">
          <FluxLogo className="mb-12 h-8 w-auto text-foreground lg:hidden" />
          <div className="w-full max-w-[360px]" style={{ height: FORM_HEIGHT }}>
            <LoginForm />
          </div>
        </section>
      </main>
    </MotionProvider>
  );
}

function Rise({
  index,
  className,
  children,
}: {
  index: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay: 0.08 + index * 0.05,
        ease: EASE_OUT,
      }}
    >
      {children}
    </motion.div>
  );
}

function BrandPanel() {
  return (
    <aside className="relative hidden flex-col overflow-hidden bg-sidebar px-12 pt-11 pb-7 text-sidebar-accent-foreground lg:flex">
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.03)_1px,transparent_1px)] bg-size-[48px_100%]"
      />
      <motion.img
        src="/login/glow-top.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -top-[340px] -left-[300px] h-[680px] w-[800px] max-w-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: EASE_OUT }}
      />
      <motion.img
        src="/login/glow-bottom.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -bottom-[264px] left-[260px] h-[560px] w-[660px] max-w-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.2, ease: EASE_OUT }}
      />

      <div className="relative flex flex-1 flex-col">
        <Rise index={0}>
          <FluxLogo className="h-10 w-auto" />
        </Rise>

        <Rise index={1} className="mt-[92px]">
          <p className="text-[44px] leading-[52px] font-semibold tracking-[-1.1px]">
            Deine Energiedaten.
            <span className="block text-brand">Klar auf einen Blick.</span>
          </p>
        </Rise>
        <Rise index={2} className="mt-5">
          <p className="max-w-[470px] text-base leading-6 text-sidebar-foreground">
            SDAT- und ESL-Dateien einlesen, Verbrauch und Zählerstand verstehen
            und sauber exportieren.
          </p>
        </Rise>

        <Rise
          index={3}
          className="mt-[42px] max-w-[600px] rounded-xl border border-sidebar-card-border bg-sidebar-card p-5"
        >
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold">
              Zählerstand
              <span className="font-normal text-sidebar-placeholder">
                {" "}
                · kWh
              </span>
            </p>
            <p className="text-xs text-sidebar-placeholder tabular-nums">
              01.01.2018 – 06.09.2021
            </p>
          </div>
          <div className="mt-2.5 flex gap-5 text-xs text-sidebar-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded-full bg-sidebar-accent-foreground" />
              Bezug
              <span className="font-medium text-sidebar-accent-foreground tabular-nums">
                50’865
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded-full bg-brand" />
              Einspeisung
              <span className="font-medium text-sidebar-accent-foreground tabular-nums">
                16’932
              </span>
            </span>
          </div>
          <div className="mt-5">
            <SamplePlot />
          </div>
        </Rise>

        <Rise
          index={4}
          className="mt-9 grid max-w-[600px] grid-cols-3 border-t border-sidebar-subtle pt-5 text-[13px]"
        >
          {FEATURES.map((feature) => (
            <div key={feature.title}>
              <p className="font-medium">{feature.title}</p>
              <p className="mt-1 text-sidebar-placeholder">{feature.text}</p>
            </div>
          ))}
        </Rise>

        <Rise index={5} className="mt-auto pt-12">
          <p className="text-xs text-sidebar-disabled">© 2026 Flux</p>
        </Rise>
      </div>
    </aside>
  );
}

type Status = "idle" | "checking" | "open";

function LoginForm() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const input = useRef<HTMLInputElement>(null);
  const [field, animate] = useAnimate<HTMLDivElement>();
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [wrong, setWrong] = useState(false);

  // the login doubles as lock screen, reaching it always locks the app
  useEffect(() => {
    endSession();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status !== "idle") return;
    if (!password) {
      input.current?.focus();
      return;
    }

    setStatus("checking");
    const ok = await checkPassword(password);
    if (ok) {
      setWrong(false);
      setStatus("open");
      startSession();
      // prefetching only now, before the session the proxy would answer with the login
      router.prefetch("/");
      setTimeout(() => router.replace("/"), 450);
      return;
    }

    setStatus("idle");
    setWrong(true);
    input.current?.focus();
    if (!reduceMotion) {
      animate(field.current, { x: [0, -6, 6, -4, 4, 0] }, { duration: 0.4 });
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col">
      <Rise index={1}>
        <h1 className="text-2xl leading-8 font-semibold tracking-[-0.4px]">
          Flux entsperren
        </h1>
        <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
          Gib das Passwort ein, um das Tool zu öffnen.
        </p>
      </Rise>

      <Rise index={2} className="mt-6">
        <label
          htmlFor="password"
          className="block text-[13px] leading-5 font-medium text-neutral-900"
        >
          Passwort
        </label>
        <div
          ref={field}
          className={cn(
            "mt-2 flex h-10 items-center gap-2 rounded-lg border bg-card pr-1 pl-3 transition-[border-color,box-shadow] duration-200",
            wrong
              ? "border-danger shadow-[0_0_0_3px_rgb(240_68_56/0.12)]"
              : "border-border-strong focus-within:border-neutral-900 focus-within:shadow-[0_0_0_3px_rgb(23_23_23/0.08)]",
          )}
        >
          <input
            ref={input}
            id="password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            autoFocus
            readOnly={status !== "idle"}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setWrong(false);
            }}
            aria-invalid={wrong}
            aria-describedby={wrong ? "password-error" : undefined}
            className={cn(
              "h-full min-w-0 flex-1 bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400",
              !visible && password && "font-semibold tracking-[3.2px]",
            )}
          />
          <button
            type="button"
            onClick={() => setVisible((shown) => !shown)}
            aria-label={visible ? "Passwort verbergen" : "Passwort anzeigen"}
            aria-pressed={visible}
            className="relative flex size-8 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors duration-150 outline-none hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={visible ? "hide" : "show"}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.18, ease: EASE_OUT }}
              >
                {visible ? (
                  <EyeOff className="size-[18px]" aria-hidden />
                ) : (
                  <Eye className="size-[18px]" aria-hidden />
                )}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>

        <AnimatePresence initial={false}>
          {wrong && (
            <motion.div
              key="error"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
              className="overflow-hidden"
            >
              <p
                id="password-error"
                role="alert"
                className="flex items-center gap-1.5 pt-2 text-[13px] leading-[17px] font-medium text-danger-strong"
              >
                <CircleAlert className="size-3.5 text-danger" aria-hidden />
                Falsches Passwort. Bitte erneut versuchen.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          type="submit"
          disabled={status !== "idle"}
          whileTap={status === "idle" ? { scale: 0.98 } : undefined}
          transition={{ duration: 0.15, ease: EASE_OUT }}
          className="mt-4 flex h-10 w-full items-center justify-center overflow-hidden rounded-lg bg-brand text-sm font-semibold text-brand-foreground transition-[filter] duration-150 outline-none hover:brightness-[0.96] focus-visible:ring-[3px] focus-visible:ring-neutral-900/20 disabled:cursor-default"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={status}
              className="flex items-center gap-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
            >
              {status === "idle" && "Entsperren"}
              {status === "checking" && (
                <>
                  <LoaderCircle
                    className="size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden
                  />
                  Wird geprüft
                </>
              )}
              {status === "open" && (
                <>
                  <Check className="size-4" aria-hidden />
                  Entsperrt
                </>
              )}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </Rise>
    </form>
  );
}
