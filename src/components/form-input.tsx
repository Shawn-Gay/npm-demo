'use client'

import React from "react"
import { Input } from "@/components/input"
import { FormField, FormLabel, FormControl, FormMessage, FormDescription, useFormContext } from "@/components/form"
import { cn } from "@/lib/utils"
import { z } from "zod"

// Utility functions for schema-driven forms
function humanizeFieldName(fieldName: string): string {
  return fieldName
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
    .trim()
}

function isFieldRequired(schema: z.ZodTypeAny): boolean {
  // Check if the field is optional by looking for ZodOptional in the type chain
  return !schema.isOptional()
}

function getFieldInfo<T extends z.ZodRawShape>(schema: z.ZodObject<T>, fieldName: keyof T) {
  const field = schema.shape[fieldName]
  if (!field) {
    throw new Error(`Field "${String(fieldName)}" not found in schema`)
  }

  return {
    name: String(fieldName),
    label: humanizeFieldName(String(fieldName)),
    // Commented out as not in use, but can be useful
    // required: isFieldRequired(field),
  }
}

// Original API (backward compatible)
type FormInputPropsOriginal = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name'> & {
  name: string
  label?: string
  description?: string
  required?: boolean
}

// New schema-driven API
type FormInputPropsSchema<T extends z.ZodRawShape> = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name'> & {
  schema?: z.ZodObject<T>
  field: keyof T
  label?: string
  description?: string
  required?: boolean
}

// Context-only schema API (field name only)
type FormInputPropsContext = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name'> & {
  field: string
  label?: string
  description?: string
  required?: boolean
}

type FormInputProps<T extends z.ZodRawShape = any> = FormInputPropsOriginal | FormInputPropsSchema<T> | FormInputPropsContext

// Type guards to distinguish between the APIs
function isSchemaProps<T extends z.ZodRawShape>(props: FormInputProps<T>): props is FormInputPropsSchema<T> {
  return 'schema' in props && 'field' in props
}

function isContextProps(props: FormInputProps): props is FormInputPropsContext {
  return 'field' in props && !('name' in props) && !('schema' in props)
}

type FormInputPropsResolved = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name'> & {
  name: string
  label?: string
  description?: string
  required?: boolean
}

export function FormInput<T extends z.ZodRawShape = any>(props: FormInputProps<T>) {
  const formContext = useFormContext()

  // Extract the resolved props based on the API being used
  const resolvedProps: FormInputPropsResolved = (() => {
    if (isSchemaProps(props)) {
      // Schema provided directly in props
      const schemaInfo = getFieldInfo(props.schema!, props.field)
      const { schema, field, ...restProps } = props
      return {
        name: schemaInfo.name,
        label: props.label ?? schemaInfo.label,
        required: props.required,
        ...restProps
      }
    } else if (isContextProps(props)) {
      // Schema from context, field name only
      if (!formContext.schema) {
        throw new Error(`FormInput with field "${props.field}" requires either a schema prop or schema in Form context`)
      }
      const schemaInfo = getFieldInfo(formContext.schema, props.field as keyof T)
      const { field, ...restProps } = props
      return {
        name: schemaInfo.name,
        label: props.label ?? schemaInfo.label,
        required: props.required,
        ...restProps
      }
    } else {
      // Original API (name-based)
      return props as FormInputPropsResolved
    }
  })()

  const {
    name,
    label,
    description,
    required,
    className,
    ...inputProps
  } = resolvedProps

  // Get preserved form data value if available
  const preservedValue = formContext.formData?.[name]
  const defaultValue = preservedValue !== undefined ? preservedValue : inputProps.defaultValue

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value
    const error = formContext.validateField(name, value)

    if (error) {
      formContext.setFieldError(name, error)
    } else {
      formContext.clearFieldError(name)
    }

    // Call original onBlur if provided
    inputProps.onBlur?.(e)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    // If there's any error (client or server), try to clear it when field becomes valid
    if (formContext.clientFieldErrors[name] || formContext.fieldErrors[name]) {
      const error = formContext.validateField(name, value)
      if (!error) {
        formContext.clearFieldError(name)
      }
    }

    // Call original onChange if provided
    inputProps.onChange?.(e)
  }

  return (
    <FormField name={name}>
      {label && (
        <FormLabel>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </FormLabel>
      )}
      <FormControl>
        <Input
          className={className}
          required={required}
          {...inputProps}
          defaultValue={defaultValue}
          onBlur={handleBlur}
          onChange={handleChange}
        />
      </FormControl>
      {description && <FormDescription>{description}</FormDescription>}
      <FormMessage />
    </FormField>
  )
}

// Textarea API types
type FormTextareaPropsOriginal = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'name'> & {
  name: string
  label?: string
  description?: string
  required?: boolean
}

type FormTextareaPropsContext = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'name'> & {
  field: string
  label?: string
  description?: string
  required?: boolean
}

type FormTextareaProps = FormTextareaPropsOriginal | FormTextareaPropsContext

export function FormTextarea(props: FormTextareaProps) {
  const formContext = useFormContext()

  const resolvedProps = (() => {
    if ('field' in props && !('name' in props)) {
      // Context API
      if (!formContext.schema) {
        throw new Error(`FormTextarea with field "${props.field}" requires schema in Form context`)
      }
      const schemaInfo = getFieldInfo(formContext.schema, props.field)
      const { field, ...restProps } = props
      return {
        name: schemaInfo.name,
        label: props.label ?? schemaInfo.label,
        required: props.required,
        ...restProps
      }
    } else {
      // Original API
      return props as FormTextareaPropsOriginal
    }
  })()

  const {
    name,
    label,
    description,
    required,
    className,
    ...textareaProps
  } = resolvedProps

  // Get preserved form data value if available
  const preservedValue = formContext.formData?.[name]
  const defaultValue = preservedValue !== undefined ? preservedValue : textareaProps.defaultValue

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const error = formContext.validateField(name, value)

    if (error) {
      formContext.setFieldError(name, error)
    } else {
      formContext.clearFieldError(name)
    }

    // Call original onBlur if provided
    textareaProps.onBlur?.(e)
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value

    // Only clear errors on change, don't show new ones until blur
    if (formContext.clientFieldErrors[name] || formContext.fieldErrors[name]) {
      const error = formContext.validateField(name, value)
      if (!error) {
        formContext.clearFieldError(name)
      }
    }

    // Call original onChange if provided
    textareaProps.onChange?.(e)
  }

  return (
    <FormField name={name}>
      {label && (
        <FormLabel>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </FormLabel>
      )}
      <FormControl>
        <textarea
          className={cn(
            'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
          // required={required}
          {...textareaProps}
          defaultValue={defaultValue}
          onBlur={handleBlur}
          onChange={handleChange}
        />
      </FormControl>
      {description && <FormDescription>{description}</FormDescription>}
      <FormMessage />
    </FormField>
  )
}

// Select API types
type FormSelectPropsOriginal = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'name'> & {
  name: string
  label?: string
  description?: string
  required?: boolean
  options: Array<{ value: string; label: string }>
  placeholder?: string
}

type FormSelectPropsContext = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'name'> & {
  field: string
  label?: string
  description?: string
  required?: boolean
  options: Array<{ value: string; label: string }>
  placeholder?: string
}

type FormSelectProps = FormSelectPropsOriginal | FormSelectPropsContext

export function FormSelect(props: FormSelectProps) {
  const formContext = useFormContext()

  const resolvedProps = (() => {
    if ('field' in props && !('name' in props)) {
      // Context API
      if (!formContext.schema) {
        throw new Error(`FormSelect with field "${props.field}" requires schema in Form context`)
      }
      const schemaInfo = getFieldInfo(formContext.schema, props.field)
      const { field, ...restProps } = props
      return {
        name: schemaInfo.name,
        label: props.label ?? schemaInfo.label,
        required: props.required,
        ...restProps
      }
    } else {
      // Original API
      return props as FormSelectPropsOriginal
    }
  })()

  const {
    name,
    label,
    description,
    required,
    options,
    placeholder = 'Select an option',
    className,
    ...selectProps
  } = resolvedProps

  // Get preserved form data value if available
  const preservedValue = formContext.formData?.[name]
  const defaultValue = preservedValue !== undefined ? preservedValue : selectProps.defaultValue

  const handleBlur = (e: React.FocusEvent<HTMLSelectElement>) => {
    const value = e.target.value
    const error = formContext.validateField(name, value)

    if (error) {
      formContext.setFieldError(name, error)
    } else {
      formContext.clearFieldError(name)
    }

    // Call original onBlur if provided
    selectProps.onBlur?.(e)
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value

    // Clear errors immediately on change for selects since users intentionally pick values
    const error = formContext.validateField(name, value)
    if (error) {
      formContext.setFieldError(name, error)
    } else {
      formContext.clearFieldError(name)
    }

    // Call original onChange if provided
    selectProps.onChange?.(e)
  }

  return (
    <FormField name={name}>
      {label && (
        <FormLabel>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </FormLabel>
      )}
      <FormControl>
        <select
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
          // required={required}
          {...selectProps}
          defaultValue={defaultValue}
          onBlur={handleBlur}
          onChange={handleChange}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormControl>
      {description && <FormDescription>{description}</FormDescription>}
      <FormMessage />
    </FormField>
  )
}

// Checkbox API types
type FormCheckboxPropsOriginal = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name' | 'type'> & {
  name: string
  label?: string
  description?: string
}

type FormCheckboxPropsContext = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name' | 'type'> & {
  field: string
  label?: string
  description?: string
}

type FormCheckboxProps = FormCheckboxPropsOriginal | FormCheckboxPropsContext

export function FormCheckbox(props: FormCheckboxProps) {
  const formContext = useFormContext()

  const resolvedProps = (() => {
    if ('field' in props && !('name' in props)) {
      // Context API - Note: checkboxes might not need schema validation for labels
      const { field, ...restProps } = props
      return {
        name: field,
        ...restProps
      }
    } else {
      // Original API
      return props as FormCheckboxPropsOriginal
    }
  })()

  const {
    name,
    label,
    description,
    className,
    ...checkboxProps
  } = resolvedProps

  // Get preserved form data value if available
  const preservedValue = formContext.formData?.[name]
  const defaultChecked = preservedValue !== undefined ?
    (Array.isArray(preservedValue) ? preservedValue.includes(checkboxProps.value) : !!preservedValue) :
    checkboxProps.defaultChecked

  return (
    <FormField name={name}>
      <div className="flex items-center space-x-2">
        <FormControl>
          <input
            type="checkbox"
            className={cn(
              'peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
              className
            )}
            {...checkboxProps}
            defaultChecked={defaultChecked}
          />
        </FormControl>
        {label && <FormLabel className="text-sm font-normal">{label}</FormLabel>}
      </div>
      {description && <FormDescription>{description}</FormDescription>}
      <FormMessage />
    </FormField>
  )
}

// RadioGroup API types
type FormRadioGroupPropsOriginal = {
  name: string
  label?: string
  description?: string
  required?: boolean
  options: Array<{ value: string; label: string }>
}

type FormRadioGroupPropsContext = {
  field: string
  label?: string
  description?: string
  required?: boolean
  options: Array<{ value: string; label: string }>
}

type FormRadioGroupProps = FormRadioGroupPropsOriginal | FormRadioGroupPropsContext

export function FormRadioGroup(props: FormRadioGroupProps) {
  const formContext = useFormContext()

  const resolvedProps = (() => {
    if ('field' in props && !('name' in props)) {
      // Context API
      if (!formContext.schema) {
        throw new Error(`FormRadioGroup with field "${props.field}" requires schema in Form context`)
      }
      const schemaInfo = getFieldInfo(formContext.schema, props.field)
      const { field, ...restProps } = props
      return {
        name: schemaInfo.name,
        label: props.label ?? schemaInfo.label,
        required: props.required,
        ...restProps
      }
    } else {
      // Original API
      return props as FormRadioGroupPropsOriginal
    }
  })()

  const {
    name,
    label,
    description,
    required,
    options,
  } = resolvedProps

  // Get preserved form data value if available
  const preservedValue = formContext.formData?.[name]

  const handleRadioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    // Clear errors immediately on change for radio buttons since users intentionally pick values
    const error = formContext.validateField(name, value)
    if (error) {
      formContext.setFieldError(name, error)
    } else {
      formContext.clearFieldError(name)
    }
  }

  return (
    <FormField name={name}>
      {label && (
        <FormLabel>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </FormLabel>
      )}
      <div className="space-y-2">
        {options.map((option) => (
          <div key={option.value} className="flex items-center space-x-2">
            <FormControl>
              <input
                type="radio"
                name={name}
                value={option.value}
                defaultChecked={preservedValue === option.value}
                className="h-4 w-4 rounded-full border border-primary text-primary focus:ring-2 focus:ring-primary"
                onChange={handleRadioChange}
                // required={required}
              />
            </FormControl>
            <label className="text-sm font-normal">{option.label}</label>
          </div>
        ))}
      </div>
      {description && <FormDescription>{description}</FormDescription>}
      <FormMessage />
    </FormField>
  )
}