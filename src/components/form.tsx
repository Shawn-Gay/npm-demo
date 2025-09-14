'use client'

import React, { createContext, useContext, useActionState, useId, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { z } from "zod"

type FormContextValue<TFormData extends Record<string, any> = Record<string, any>> = {
  fieldErrors: Partial<Record<keyof TFormData, string>>
  formError: string | null
  isSubmitting: boolean
  formId: string
  schema?: z.ZodObject<any>
  formData?: Record<string, any>
  validateField: (fieldName: string, value: any) => string | null
  clearFieldError: (fieldName: string) => void
  setFieldError: (fieldName: string, error: string) => void
  clientFieldErrors: Record<string, string>
  clearedServerErrors: Set<string>
}

const FormContext = createContext<FormContextValue | null>(null)

export function useFormContext<TFormData extends Record<string, any> = Record<string, any>>(): FormContextValue<TFormData> {
  const context = useContext(FormContext)
  if (!context) {
    throw new Error('useFormContext must be used within a Form component')
  }
  return context as FormContextValue<TFormData>
}

type FormFieldContextValue = {
  name: string
  fieldId: string
  hasError: boolean
  errorMessage?: string
}

const FormFieldContext = createContext<FormFieldContextValue | null>(null)

export function useFormField(): FormFieldContextValue {
  const context = useContext(FormFieldContext)
  if (!context) {
    throw new Error('useFormField must be used within a FormField component')
  }
  return context
}

export type FormState = {
  success: boolean
  data?: any
  error?: string
  fieldErrors?: Record<string, string>
}

type FormProps<TFormData extends Record<string, any> = Record<string, any>> = Omit<
  React.FormHTMLAttributes<HTMLFormElement>,
  'action'
> & {
  action: (prevState: FormState, formData: FormData) => FormState | Promise<FormState>;
  initialState?: FormState;
  onSuccess?: (data: any) => void;
  children: React.ReactNode;
  schema?: z.ZodObject<any>;
};

export function Form<TFormData extends Record<string, any> = Record<string, any>>({
  action,
  initialState = { success: false },
  onSuccess,
  children,
  className,
  schema,
  ...props
}: FormProps<TFormData>) {
  const formId = useId()
  const [state, formAction, isPending] = useActionState(action, initialState)
  const [clientFieldErrors, setClientFieldErrors] = useState<Record<string, string>>({})
  const [clearedServerErrors, setClearedServerErrors] = useState<Set<string>>(new Set())

  React.useEffect(() => {
    if (state.success && onSuccess && state.data) {
      onSuccess(state.data)
    }
  }, [state.success, state.data, onSuccess])

  // Reset cleared server errors when new server errors come in
  React.useEffect(() => {
    if (state.fieldErrors) {
      setClearedServerErrors(new Set())
    }
  }, [state.fieldErrors])

  const validateField = useCallback((fieldName: string, value: any): string | null => {
    if (!schema) return null

    try {
      const fieldSchema = schema.shape[fieldName]
      if (!fieldSchema) return null

      // For validation, parse the actual value (empty string should be treated as empty)
      fieldSchema.parse(value)
      return null
    } catch (error) {
      if (error instanceof z.ZodError) {
        return error.issues[0]?.message || 'Invalid value'
      }
    }
    return null
  }, [schema])

  const clearFieldError = useCallback((fieldName: string) => {
    setClientFieldErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[fieldName]
      return newErrors
    })
    setClearedServerErrors(prev => new Set([...prev, fieldName]))
  }, [])

  const setFieldError = useCallback((fieldName: string, error: string) => {
    setClientFieldErrors(prev => ({
      ...prev,
      [fieldName]: error
    }))
  }, [])

  const contextValue: FormContextValue<TFormData> = {
    fieldErrors: (state.fieldErrors || {}) as Partial<Record<keyof TFormData, string>>,
    formError: state.error || null,
    isSubmitting: isPending,
    formId,
    schema,
    formData: state.data as Record<string, any> | undefined,
    validateField,
    clearFieldError,
    setFieldError,
    clientFieldErrors,
    clearedServerErrors,
  }

  return (
    <FormContext.Provider value={contextValue}>
      <form
        action={formAction}
        className={cn('space-y-4', className)}
        {...props}
      >
        {children}
      </form>
    </FormContext.Provider>
  )
}

type FormFieldProps = {
  name: string
  children: React.ReactNode
}

export function FormField({ name, children }: FormFieldProps) {
  const { fieldErrors, formId, clientFieldErrors, clearedServerErrors } = useFormContext()
  const fieldId = `${formId}-${name}`

  // Show server error only if it hasn't been cleared by user interaction
  const serverError = clearedServerErrors.has(name) ? null : fieldErrors[name]
  const clientError = clientFieldErrors[name]
  const errorMessage = serverError || clientError
  const hasError = Boolean(errorMessage)

  const contextValue: FormFieldContextValue = {
    name,
    fieldId,
    hasError,
    errorMessage,
  }

  return (
    <FormFieldContext.Provider value={contextValue}>
      <div className="space-y-2">
        {children}
      </div>
    </FormFieldContext.Provider>
  )
}

type FormLabelProps = React.LabelHTMLAttributes<HTMLLabelElement>

export function FormLabel({ className, ...props }: FormLabelProps) {
  const { fieldId } = useFormField()

  return (
    <label
      htmlFor={fieldId}
      className={cn(
        'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className
      )}
      {...props}
    />
  )
}

type FormControlProps = {
  children: React.ReactElement
}

export function FormControl({ children }: FormControlProps) {
  const { fieldId, hasError, name } = useFormField()

  return React.cloneElement(children, {
    id: fieldId,
    name,
    'aria-invalid': hasError ? 'true' : 'false',
    'aria-describedby': hasError ? `${fieldId}-error` : undefined,
  } as React.HTMLAttributes<HTMLElement>);
}

type FormDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>

export function FormDescription({ className, ...props }: FormDescriptionProps) {
  return (
    <p
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

type FormMessageProps = React.HTMLAttributes<HTMLParagraphElement>

export function FormMessage({ className, ...props }: FormMessageProps) {
  const { hasError, errorMessage, fieldId } = useFormField()

  if (!hasError || !errorMessage) {
    return null
  }

  return (
    <p
      id={`${fieldId}-error`}
      className={cn('text-sm font-medium text-destructive', className)}
      {...props}
    >
      {errorMessage}
    </p>
  )
}

type FormErrorProps = React.HTMLAttributes<HTMLDivElement>

export function FormError({ className, ...props }: FormErrorProps) {
  const { formError } = useFormContext()

  if (!formError) {
    return null
  }

  return (
    <div
      className={cn(
        'rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive',
        className
      )}
      {...props}
    >
      {formError}
    </div>
  )
}

type FormSubmitProps = React.ButtonHTMLAttributes<HTMLButtonElement>

export function FormSubmit({ className, children, ...props }: FormSubmitProps) {
  const { isSubmitting } = useFormContext()

  return (
    <button
      type="submit"
      disabled={isSubmitting || props.disabled}
      className={cn(
        'inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      {...props}
    >
      {isSubmitting ? 'Submitting...' : children}
    </button>
  )
}