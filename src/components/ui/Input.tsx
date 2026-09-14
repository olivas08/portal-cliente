"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export const inputCls =
  "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:bg-slate-50 disabled:text-slate-400";

interface FieldProps {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
}

export function Field({ label, htmlFor, hint, children }: FieldProps) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium text-slate-600 mb-1.5"
      >
        {label}
      </label>
      {children}
      {hint}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
}

export function Input({ label, id, className = "", ...props }: InputProps) {
  const input = (
    <input id={id} className={`${inputCls} ${className}`} {...props} />
  );
  if (!label) return input;
  return (
    <Field label={label} htmlFor={id}>
      {input}
    </Field>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
}

export function Textarea({ label, id, className = "", ...props }: TextareaProps) {
  const area = (
    <textarea
      id={id}
      className={`${inputCls} resize-none ${className}`}
      {...props}
    />
  );
  if (!label) return area;
  return (
    <Field label={label} htmlFor={id}>
      {area}
    </Field>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
}

export function Select({ label, id, className = "", children, ...props }: SelectProps) {
  const select = (
    <select id={id} className={`${inputCls} ${className}`} {...props}>
      {children}
    </select>
  );
  if (!label) return select;
  return (
    <Field label={label} htmlFor={id}>
      {select}
    </Field>
  );
}
