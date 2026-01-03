type Rect = {
    left: number;
    top: number;
    width: number;
    height: number;
};

/**
 * Вырезает часть изображения и возвращает его как base64
 */
export const cropImage = (imageUrl: string, crop: Rect): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imageUrl;

        img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            if (!ctx) {
                reject(new Error("Не удалось создать контекст Canvas"));
                return;
            }

            // Устанавливаем размер canvas равным размеру выделения
            canvas.width = crop.width;
            canvas.height = crop.height;

            // Рисуем только нужный кусок
            // drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
            ctx.drawImage(
                img,
                crop.left, crop.top, crop.width, crop.height, // Откуда берем (с исходника)
                0, 0, crop.width, crop.height // Куда рисуем (на canvas)
            );

            // Возвращаем Data URL (base64)
            resolve(canvas.toDataURL("image/png"));
        };

        img.onerror = (err) => reject(err);
    });
};