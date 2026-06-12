import { useCallback, useState } from "react";

export function useDeliveryModeController() {
  const [deliveryModeOpen, setDeliveryModeOpen] = useState(false);

  const openDeliveryMode = useCallback(() => {
    setDeliveryModeOpen(true);
  }, []);

  const closeDeliveryMode = useCallback(() => {
    setDeliveryModeOpen(false);
  }, []);

  const continueToDeliveryExport = useCallback((openExport: () => void) => {
    setDeliveryModeOpen(false);
    openExport();
  }, []);

  return {
    deliveryModeOpen,
    openDeliveryMode,
    closeDeliveryMode,
    continueToDeliveryExport,
  };
}
