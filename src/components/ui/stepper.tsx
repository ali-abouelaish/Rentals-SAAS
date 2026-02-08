import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Check } from "lucide-react";

interface Step {
    id: string;
    label: string;
    description?: string;
}

interface StepperProps {
    steps: Step[];
    currentStep: number;
    className?: string;
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
    return (
        <div className={cn("w-full", className)}>
            <div className="flex items-center justify-between">
                {steps.map((step, index) => {
                    const stepNumber = index + 1;
                    const isCompleted = stepNumber < currentStep;
                    const isCurrent = stepNumber === currentStep;
                    const isUpcoming = stepNumber > currentStep;

                    return (
                        <React.Fragment key={step.id}>
                            <div className="flex flex-col items-center flex-1">
                                {/* Step Circle */}
                                <div
                                    className={cn(
                                        "relative flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold text-sm transition-all duration-300",
                                        isCompleted && "border-accent bg-accent text-brand-950",
                                        isCurrent && "border-accent bg-white text-accent scale-110 shadow-glow",
                                        isUpcoming && "border-gray-300 bg-white text-gray-400"
                                    )}
                                >
                                    {isCompleted ? (
                                        <Check className="h-5 w-5" />
                                    ) : (
                                        stepNumber
                                    )}
                                </div>

                                {/* Step Label */}
                                <div className="mt-2 text-center">
                                    <p
                                        className={cn(
                                            "text-sm font-medium transition-colors",
                                            isCurrent && "text-brand",
                                            isCompleted && "text-gray-700",
                                            isUpcoming && "text-gray-400"
                                        )}
                                    >
                                        {step.label}
                                    </p>
                                    {step.description && (
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {step.description}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Connector Line */}
                            {index < steps.length - 1 && (
                                <div className="flex items-center px-2 -mt-8">
                                    <div
                                        className={cn(
                                            "h-[2px] w-full transition-all duration-300",
                                            stepNumber < currentStep ? "bg-accent" : "bg-gray-300"
                                        )}
                                    />
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}

interface WizardStepProps {
    children: React.ReactNode;
    className?: string;
}

export function WizardStep({ children, className }: WizardStepProps) {
    return (
        <div className={cn("animate-in slide-in-from-right-4 fade-in-0 duration-300", className)}>
            {children}
        </div>
    );
}

interface WizardNavigationProps {
    currentStep: number;
    totalSteps: number;
    onNext?: () => void;
    onBack?: () => void;
    onCancel?: () => void;
    nextLabel?: string;
    backLabel?: string;
    isNextDisabled?: boolean;
    isLoading?: boolean;
}

export function WizardNavigation({
    currentStep,
    totalSteps,
    onNext,
    onBack,
    onCancel,
    nextLabel = "Next",
    backLabel = "Back",
    isNextDisabled = false,
    isLoading = false,
}: WizardNavigationProps) {
    const isFirstStep = currentStep === 1;
    const isLastStep = currentStep === totalSteps;

    return (
        <div className="flex items-center justify-between border-t border-gray-200 pt-4 mt-6">
            <div>
                {!isFirstStep && onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-brand transition-colors"
                        disabled={isLoading}
                    >
                        ← {backLabel}
                    </button>
                )}
                {isFirstStep && onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                )}
            </div>

            {onNext && (
                <button
                    type="button"
                    onClick={onNext}
                    disabled={isNextDisabled || isLoading}
                    className={cn(
                        "inline-flex items-center justify-center rounded-xl px-6 py-2.5 text-sm font-medium transition-all",
                        "bg-brand text-white hover:bg-brand-light disabled:opacity-50 disabled:cursor-not-allowed",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                        isLastStep && "bg-accent text-brand-950 hover:bg-accent/90"
                    )}
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Processing...
                        </>
                    ) : (
                        <>
                            {isLastStep ? "Complete" : nextLabel}
                            {!isLastStep && " →"}
                        </>
                    )}
                </button>
            )}
        </div>
    );
}
