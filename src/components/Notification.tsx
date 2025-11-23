type NotificationProps = {
  message: string;
  details: string;
  onClose: () => void;
};

const Notification = ({ message, details, onClose }: NotificationProps) => {
  return (
    <div className="fixed top-5 right-5 bg-[#1a1a1a] text-white border border-gray-600 rounded-xl shadow-lg p-4 w-[280px] animate-slidefade">
      <div className="flex justify-between items-center">
        <span className="font-semibold text-green-400">{message}</span>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          ✕
        </button>
      </div>

      <p className="text-sm text-gray-300 mt-2">{details}</p>
    </div>
  );
};

export default Notification;
