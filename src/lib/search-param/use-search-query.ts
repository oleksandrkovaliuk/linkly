import { useDebouncer } from "@tanstack/react-pacer";
import { parseAsString, useQueryState } from "nuqs";
import * as React from "react";

export function useSearchQuery(paramKey = "q") {
  const [query, setQuery] = useQueryState(
    paramKey,
    parseAsString.withDefault("").withOptions({ clearOnDefault: true })
  );
  const [debouncedQuery, setDebouncedQuery] = React.useState(query);

  const debouncer = useDebouncer(
    (nextValue: string) => {
      setDebouncedQuery(nextValue);
    },
    {
      wait: 250,
    }
  );

  React.useEffect(() => {
    debouncer.maybeExecute(query);
  }, [debouncer, query]);

  React.useEffect(() => {
    if (!query) {
      setDebouncedQuery("");
    }
  }, [query]);

  return { query, setQuery, debouncedQuery };
}
