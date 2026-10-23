"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";
import { Field } from "@/features/helpdesk/ui/Field";
import { createManualListing, updateManualListing } from "../actions/listings";
import {
  BILLS_OPTIONS,
  COUPLES_OPTIONS,
  EMPTY_MANUAL_LISTING,
  FURNISHING_OPTIONS,
  MAX_MANUAL_PHOTOS,
  manualListingSchema,
  type ManualListingValues,
} from "../domain/schemas";

// Matches <Input>, so the native selects sit flush with the text fields.
const selectCls =
  "flex h-11 w-full rounded-lg border border-border bg-surface-card px-3 text-base text-foreground md:h-10 sm:text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-border-ring/20 disabled:opacity-50";

type Props =
  | { mode: "create"; landlordId: string }
  | { mode: "edit"; listingId: string; initial: ManualListingValues };

/**
 * Add or edit a listing typed in by hand. Only manual listings are editable:
 * scraped and spreadsheet rows are rewritten by their next run.
 */
export function ManualListingDialog(props: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const initial = props.mode === "edit" ? props.initial : EMPTY_MANUAL_LISTING;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ManualListingValues>({
    resolver: zodResolver(manualListingSchema),
    defaultValues: initial,
  });

  const onSubmit = (values: ManualListingValues) => {
    startTransition(async () => {
      const result =
        props.mode === "create"
          ? await createManualListing(props.landlordId, values)
          : await updateManualListing(props.listingId, values);
      if (!result.ok) {
        toast.error("Couldn't save the listing", { description: result.error, duration: 6000 });
        return;
      }
      toast.success(props.mode === "create" ? "Listing added" : "Listing updated", {
        description: result.located
          ? undefined
          : "It isn't on the map — check the location includes a full UK postcode.",
      });
      setOpen(false);
      router.refresh();
    });
  };

  // Shared aria wiring: errors replace the hint as the field's description.
  const aria = (name: keyof ManualListingValues, id: string) => ({
    id,
    disabled: isPending,
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `${id}-error` : undefined,
  });

  const trigger =
    props.mode === "create" ? (
      <Button type="button" variant="secondary" size="sm" className="gap-2">
        <Plus className="h-4 w-4" />
        Add listing
      </Button>
    ) : (
      <Button type="button" variant="outline" size="xs" className="gap-1.5">
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </Button>
    );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset(initial);
      }}
    >
      {props.mode === "create" ? (
        <Tooltip content="For a landlord who sends availability by phone or email. Listings added here aren't touched by the scraper or a spreadsheet, and stay live until you delete them.">
          <DialogTrigger asChild>{trigger}</DialogTrigger>
        </Tooltip>
      ) : (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{props.mode === "create" ? "Add a listing" : "Edit listing"}</DialogTitle>
          <DialogDescription>
            It appears in this landlord&apos;s Listings, on the map, in your listings API, and in enquiry-email
            matching, just like a scraped listing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <Field
            id="ml-title"
            label="Title *"
            hint='The headline, up to 200 characters, e.g. "Double room in Fallowfield".'
            error={errors.title?.message}
          >
            <Input {...aria("title", "ml-title")} autoComplete="off" {...register("title")} />
          </Field>

          <Field
            id="ml-location"
            label="Location / address"
            hint="Address or area, up to 300 characters. Include the postcode to put it on the map."
            tooltip="We look up the first full UK postcode in this text to place a pin on the map. Without one the listing still saves, it just isn't on the map."
            error={errors.location?.message}
          >
            <Input {...aria("location", "ml-location")} autoComplete="off" {...register("location")} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="ml-price"
              label="Rent (PCM)"
              hint="Monthly rent in pounds, e.g. 750. Leave blank if not agreed yet."
              error={errors.price?.message}
            >
              <Input {...aria("price", "ml-price")} inputMode="decimal" autoComplete="off" {...register("price")} />
            </Field>

            <Field
              id="ml-deposit"
              label="Deposit"
              hint="In pounds, e.g. 750. Optional."
              error={errors.deposit?.message}
            >
              <Input
                {...aria("deposit", "ml-deposit")}
                inputMode="decimal"
                autoComplete="off"
                {...register("deposit")}
              />
            </Field>

            <Field
              id="ml-available"
              label="Available from"
              hint="The first day it can be moved into. Optional."
              error={errors.available_date?.message}
            >
              <Input {...aria("available_date", "ml-available")} type="date" {...register("available_date")} />
            </Field>

            <Field
              id="ml-min-term"
              label="Minimum term"
              hint="Free text, up to 50 characters, e.g. 6 months."
              error={errors.min_term?.message}
            >
              <Input {...aria("min_term", "ml-min-term")} autoComplete="off" {...register("min_term")} />
            </Field>

            <Field
              id="ml-type"
              label="Property type"
              hint="Up to 100 characters, e.g. Double room, Studio, 2-bed flat."
              error={errors.property_type?.message}
            >
              <Input {...aria("property_type", "ml-type")} autoComplete="off" {...register("property_type")} />
            </Field>

            <Field
              id="ml-rooms"
              label="Rooms available"
              hint="Whole number from 1 to 50. Optional."
              error={errors.room_count?.message}
            >
              <Input
                {...aria("room_count", "ml-rooms")}
                inputMode="numeric"
                autoComplete="off"
                {...register("room_count")}
              />
            </Field>

            <Field
              id="ml-bills"
              label="Bills included"
              hint="Pick one, or leave as Not specified."
              error={errors.bills_included?.message}
            >
              <select {...aria("bills_included", "ml-bills")} className={selectCls} {...register("bills_included")}>
                <option value="">Not specified</option>
                {BILLS_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              id="ml-furnishings"
              label="Furnishings"
              hint="Pick one, or leave as Not specified."
              error={errors.furnishings?.message}
            >
              <select {...aria("furnishings", "ml-furnishings")} className={selectCls} {...register("furnishings")}>
                <option value="">Not specified</option>
                {FURNISHING_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              id="ml-couples"
              label="Couples OK"
              hint="Leave as Not specified if you don't know."
              tooltip="The map's Double occupancy filter only shows listings marked Yes, so set this when the room suits a couple."
              error={errors.couples_ok?.message}
            >
              <select {...aria("couples_ok", "ml-couples")} className={selectCls} {...register("couples_ok")}>
                <option value="">Not specified</option>
                {COUPLES_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field
            id="ml-url"
            label="Advert link"
            hint="Optional. A full link starting with https://, e.g. the advert on your website."
            tooltip="With a link, View in the Listings table opens the advert. Without one, it opens a details panel with everything entered here."
            error={errors.url?.message}
          >
            <Input {...aria("url", "ml-url")} type="url" inputMode="url" autoComplete="off" {...register("url")} />
          </Field>

          <Field
            id="ml-photos"
            label="Photo links"
            hint={`One https:// image link per line, up to ${MAX_MANUAL_PHOTOS}. The first is the main photo.`}
            tooltip="Use direct links to images that anyone can open. They're shown to everyone who sees this listing, including through your listings API."
            error={errors.photo_urls?.message}
          >
            <Textarea {...aria("photo_urls", "ml-photos")} rows={3} {...register("photo_urls")} />
          </Field>

          <Field
            id="ml-description"
            label="Description"
            hint="Up to 5,000 characters. Optional."
            error={errors.description?.message}
          >
            <Textarea {...aria("description", "ml-description")} rows={5} {...register("description")} />
          </Field>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" loading={isPending} disabled={isPending} className="gap-2">
              <Save className="h-4 w-4" />
              {props.mode === "create" ? "Add listing" : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
