import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { PersonDto } from "@/server/features/social/dto";

type PersonAvatarProps = {
  person: Pick<PersonDto, "initials" | "avatarUrl">;
  className?: string;
};

/** A person's photo, or their initials. Decorative: the name next to it carries the meaning. */
export function PersonAvatar({ person, className }: PersonAvatarProps) {
  return (
    <Avatar aria-hidden="true" className={cn("size-10", className)}>
      {person.avatarUrl ? <AvatarImage src={person.avatarUrl} alt="" /> : null}
      <AvatarFallback className="bg-secondary font-medium text-secondary-foreground">{person.initials}</AvatarFallback>
    </Avatar>
  );
}
